// One-shot prep script for the Pantheon 2.0 dataset.
//
// Pulls the bz2-compressed CSV from Google Cloud Storage, decompresses
// (via macOS-builtin `bzcat`), filters + sorts, and emits two ranked CSVs
// into public/data/:
//
//   pantheon-athletes-top500.csv     domain == "Sports", top 500 by HPI
//   pantheon-celebrities-top500.csv  domain != "Sports" + birthyear >= 1900,
//                                    top 500 by HPI
//
// After running, paste the dev URLs into the Source URL field (or commit
// the files and use the deployed URL):
//
//   http://localhost:3000/data/pantheon-athletes-top500.csv
//   http://localhost:3000/data/pantheon-celebrities-top500.csv
//
// Usage:
//   node scripts/prep-pantheon.mjs

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const SRC_URL = "https://storage.googleapis.com/pantheon-public-data/person_2025_update.csv.bz2";
const TMP_CSV = "/tmp/pantheon-2025.csv";
const OUT_DIR = resolve(process.cwd(), "public/data");

// 1. Download + decompress (cache in /tmp so re-runs are fast)
mkdirSync(OUT_DIR, { recursive: true });
if (!existsSync(TMP_CSV) || statSync(TMP_CSV).size < 1_000_000) {
  console.log(`Downloading + decompressing → ${TMP_CSV} ...`);
  execSync(`curl -sL "${SRC_URL}" | bzcat > "${TMP_CSV}"`, { stdio: "inherit" });
}
const sizeMb = (statSync(TMP_CSV).size / 1024 / 1024).toFixed(1);
console.log(`Source CSV: ${sizeMb} MB`);

// 2. Read + parse the CSV
const raw = readFileSync(TMP_CSV, "utf-8");
const rows = parseCsv(raw);
const headers = rows[0];
const records = rows.slice(1).map((r) => {
  const o = {};
  for (let i = 0; i < headers.length; i++) o[headers[i]] = r[i] ?? "";
  return o;
});
console.log(`Parsed ${records.length} records.`);
console.log(`Columns: ${headers.join(", ")}`);

// 3. Identify the columns we care about. Pantheon's column names occasionally
//    drift between releases; we look up by best-match. The 2025 release
//    dropped `domain`/`industry` — we filter by occupation instead.
const COL = {
  name: pickCol(headers, ["name"]),
  hpi: pickCol(headers, ["hpi", "HPI"]),
  birthyear: pickCol(headers, ["birthyear"]),
  occupation: pickCol(headers, ["occupation"]),
  birthcountry: pickCol(headers, ["bplace_country", "birthcountry", "countryname"]),
  gender: pickCol(headers, ["gender"]),
  slug: pickCol(headers, ["slug", "article_id", "en_curid"]),
};
console.log("Column map:", COL);

const required = ["name", "hpi", "occupation"];
for (const k of required) {
  if (!COL[k]) throw new Error(`Missing required column: ${k}. Pantheon schema may have changed.`);
}

// Known athletic occupations in Pantheon's controlled vocabulary, plus a
// regex fallback for shapes we missed.
const SPORTS_OCCUPATIONS = new Set([
  "AMERICAN FOOTBALL PLAYER", "ATHLETICS COMPETITOR", "AUSTRALIAN RULES FOOTBALL PLAYER",
  "BADMINTON PLAYER", "BASEBALL PLAYER", "BASKETBALL PLAYER", "BIATHLETE",
  "BOBSLEDDER", "BOWLER", "BOXER", "CRICKETER", "CYCLIST", "DARTS PLAYER",
  "DECATHLETE", "DRESSAGE RIDER", "EQUESTRIAN", "FENCER", "FIGURE SKATER",
  "FOOTBALL PLAYER", "FORMULA 1 RACING DRIVER", "GAELIC FOOTBALL PLAYER",
  "GO PLAYER", "GOLFER", "GYMNAST", "HANDBALL PLAYER", "HEPTATHLETE",
  "HIGH JUMPER", "HOCKEY PLAYER", "HORSE TRAINER", "HURDLER", "ICE DANCER",
  "ICE HOCKEY PLAYER", "JAVELIN THROWER", "JOCKEY", "JUDOKA", "KARATEKA",
  "LACROSSE PLAYER", "LONG-DISTANCE RUNNER", "LONG JUMPER", "MARATHON RUNNER",
  "MARTIAL ARTIST", "MIDDLE-DISTANCE RUNNER", "MIXED MARTIAL ARTIST", "MMA FIGHTER",
  "MOTORCYCLE RACER", "MOUNTAIN CLIMBER", "PARALYMPIC ATHLETE", "POLE VAULTER",
  "POKER PLAYER", "POOL PLAYER", "PROFESSIONAL WRESTLER", "RACING DRIVER",
  "RALLY DRIVER", "ROWER", "RUGBY LEAGUE PLAYER", "RUGBY UNION PLAYER",
  "RUNNER", "SAILOR", "SHORT TRACK SPEED SKATER", "SHOT PUTTER", "SKATEBOARDER",
  "SKI JUMPER", "SKIER", "SNOOKER PLAYER", "SNOWBOARDER", "SOCCER PLAYER",
  "SOFTBALL PLAYER", "SPEED SKATER", "SPRINTER", "SQUASH PLAYER", "SUMO WRESTLER",
  "SURFER", "SWIMMER", "TABLE TENNIS PLAYER", "TAEKWONDO ATHLETE", "TENNIS PLAYER",
  "TRACK CYCLIST", "TRIATHLETE", "VOLLEYBALL PLAYER", "WATER POLO PLAYER",
  "WEIGHTLIFTER", "WRESTLER",
]);
const SPORTS_REGEX = /(PLAYER|ATHLETE|BOXER|WRESTLER|SKIER|SWIMMER|RUNNER|RACER|CYCLIST|GYMNAST|FIGHTER|SKATER|JOCKEY|GOLFER|JUMPER|THROWER|HURDLER|ROWER|DRIVER|SAILOR|SURFER|CLIMBER)/i;

function isAthlete(occupation) {
  if (!occupation) return false;
  const upper = occupation.toUpperCase().trim();
  if (SPORTS_OCCUPATIONS.has(upper)) return true;
  return SPORTS_REGEX.test(upper);
}

// Modern entertainment celebrities: the Paparazza cohort. Excludes
// politicians, royalty, religious figures, scientists, activists, AND
// classical composers/conductors (different fame mechanism, not gossip).
const ENTERTAINER_OCCUPATIONS = new Set([
  "ACTOR", "ACTRESS", "FILM ACTOR", "FILM ACTRESS", "STAGE ACTOR",
  "TELEVISION ACTOR", "TELEVISION ACTRESS", "VOICE ACTOR", "VOICE ACTRESS",
  "SINGER", "POP SINGER", "ROCK SINGER", "COUNTRY SINGER", "OPERA SINGER",
  "JAZZ SINGER", "FOLK SINGER", "R&B SINGER", "RAPPER", "SONGWRITER",
  "MUSICIAN", "GUITARIST", "BASSIST", "DRUMMER", "PIANIST", "VIOLINIST",
  "DJ",
  "COMEDIAN", "STAND-UP COMEDIAN",
  "MODEL", "FASHION MODEL",
  "TELEVISION PRESENTER", "TV PRESENTER", "RADIO PRESENTER", "TALK SHOW HOST",
  "DANCER", "BALLET DANCER", "CHOREOGRAPHER",
  "FILM DIRECTOR", "FILM PRODUCER", "SCREENWRITER", "FILMMAKER",
  "MAGICIAN", "ENTERTAINER", "PERFORMER",
]);
const ENTERTAINER_REGEX = /\b(ACTOR|ACTRESS|SINGER|RAPPER|MUSICIAN|GUITARIST|DRUMMER|PIANIST|MODEL|COMEDIAN|DANCER|PRESENTER|HOST|FILMMAKER|FILM (DIRECTOR|PRODUCER)|ENTERTAINER|PERFORMER)\b/;

function isEntertainer(occupation) {
  if (!occupation) return false;
  const upper = occupation.toUpperCase().trim();
  // Hard exclusions: classical / fine-art musicians don't belong in Paparazza.
  if (upper === "COMPOSER" || upper === "CONDUCTOR") return false;
  if (ENTERTAINER_OCCUPATIONS.has(upper)) return true;
  return ENTERTAINER_REGEX.test(upper);
}

// 4. Build derivative datasets
const all = records
  .map((r) => ({
    name: (r[COL.name] ?? "").trim(),
    hpi: parseFloat(r[COL.hpi]),
    birthyear: parseIntSafe(r[COL.birthyear]),
    occupation: (r[COL.occupation] ?? "").trim(),
    birthcountry: COL.birthcountry ? (r[COL.birthcountry] ?? "").trim() : "",
    gender: COL.gender ? (r[COL.gender] ?? "").trim() : "",
    slug: COL.slug ? (r[COL.slug] ?? "").trim() : "",
  }))
  .filter((r) => r.name && Number.isFinite(r.hpi));

console.log(`Usable records (name + numeric HPI): ${all.length}`);

const athletes = all.filter((r) => isAthlete(r.occupation));
const celebs = all.filter(
  (r) => isEntertainer(r.occupation) && (r.birthyear ?? 0) >= 1900,
);

athletes.sort((a, b) => b.hpi - a.hpi);
celebs.sort((a, b) => b.hpi - a.hpi);

const athletesTop = athletes.slice(0, 500).map((r, i) => ({ rank: i + 1, ...r, wiki_url: makeWikiUrl(r.name, r.slug) }));
const celebsTop = celebs.slice(0, 500).map((r, i) => ({ rank: i + 1, ...r, wiki_url: makeWikiUrl(r.name, r.slug) }));

console.log(`Athletes pool: ${athletes.length} → top 500. Top: ${athletesTop[0].name} (HPI ${athletesTop[0].hpi.toFixed(2)})`);
console.log(`Celebs pool:   ${celebs.length} → top 500. Top: ${celebsTop[0].name} (HPI ${celebsTop[0].hpi.toFixed(2)})`);

// 5. Write CSV outputs with explicit ranks
const cols = ["rank", "name", "occupation", "birthcountry", "birthyear", "gender", "hpi", "wiki_url"];

writeFileSync(`${OUT_DIR}/pantheon-athletes-top500.csv`, toCsv(cols, athletesTop));
writeFileSync(`${OUT_DIR}/pantheon-celebrities-top500.csv`, toCsv(cols, celebsTop));

console.log(`\n✔ Wrote:
  ${OUT_DIR}/pantheon-athletes-top500.csv
  ${OUT_DIR}/pantheon-celebrities-top500.csv

Use these Source URLs in the agent panel:
  Athletes:    http://localhost:3000/data/pantheon-athletes-top500.csv
  Celebrities: http://localhost:3000/data/pantheon-celebrities-top500.csv
`);

// ─── helpers ────────────────────────────────────────────────

function pickCol(headers, candidates) {
  for (const c of candidates) {
    const exact = headers.indexOf(c);
    if (exact >= 0) return c;
  }
  for (const c of candidates) {
    const ci = headers.find((h) => h.toLowerCase() === c.toLowerCase());
    if (ci) return ci;
  }
  return null;
}

function parseIntSafe(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v).match(/-?\d+/)?.[0] ?? "", 10);
  return Number.isFinite(n) ? n : null;
}

function makeWikiUrl(name, slug) {
  const usable = slug && /[A-Za-z]/.test(slug) ? slug : name.replace(/\s+/g, "_");
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(usable).replace(/%2F/g, "/")}`;
}

// Minimal RFC-4180-ish CSV parser, same shape as the route's parser.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === "") { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\n" || ch === "\r") {
      row.push(field); rows.push(row); row = []; field = "";
      if (ch === "\r" && text[i + 1] === "\n") i += 2;
      else i++;
      continue;
    }
    field += ch; i++;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function toCsv(cols, records) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const r of records) lines.push(cols.map((c) => esc(r[c])).join(","));
  return lines.join("\n") + "\n";
}
