import Anthropic from "@anthropic-ai/sdk";
import type { TriviaSourceItem } from "./types";

const MODEL = "claude-sonnet-4-6";

export interface NormalizeResult {
  items: TriviaSourceItem[];
  mapping: FieldMapping;
  arrayLength: number;
  format: "json" | "tsv" | "csv";
}

/**
 * Fetch a URL, then normalize. Wrapper around normalizeText.
 */
export async function normalizeSourceUrl(
  sourceUrl: string,
  anthropicApiKey: string,
): Promise<NormalizeResult> {
  const res = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "johnmarr-trivia-agent/1.0",
      Accept: "application/json,text/tab-separated-values,text/csv,text/plain,*/*",
    },
  });
  if (!res.ok) throw new Error(`Source fetch failed: HTTP ${res.status}`);
  const rawText = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  return normalizeText(rawText, contentType, sourceUrl, anthropicApiKey);
}

/**
 * Normalize raw text (JSON / TSV / CSV) into canonical items.
 * Used by both the URL path and the paste-JSON path.
 */
export async function normalizeText(
  rawText: string,
  contentTypeHint: string,
  sourceLabel: string,
  anthropicApiKey: string,
): Promise<NormalizeResult> {
  // 1. Detect format + parse to array
  const detected = detectAndParse(rawText, contentTypeHint, sourceLabel);
  const arr = detected.array;
  if (!arr || arr.length === 0) {
    throw new Error("No list of items found in the source.");
  }

  // 4. Build a column sniff for Claude
  const columnSniff = buildColumnSniff(arr);
  const topShape =
    detected.format === "json" && detected.topLevelKeys
      ? `top-level keys: ${detected.topLevelKeys}`
      : `format: ${detected.format}`;

  const mapping = await askClaudeForMapping(anthropicApiKey, topShape, columnSniff);

  // Validate name field — without it nothing maps
  const firstItem = arr[0]!;
  if (!mapping.nameField || !(mapping.nameField in firstItem)) {
    throw new Error(
      `Claude could not identify a name field. Sample columns: ${Object.keys(firstItem).join(", ")}`,
    );
  }

  // 5. Apply mapping
  const items: TriviaSourceItem[] = [];
  for (let i = 0; i < arr.length; i++) {
    const o = arr[i]!;
    const rank =
      mapping.rankField && mapping.rankField in o ? toInt(o[mapping.rankField]) : i + 1;
    const name = toStr(o[mapping.nameField]);
    if (!rank || rank <= 0 || !name) continue;

    const item: TriviaSourceItem = { rank, name };
    if (mapping.creatorField && mapping.creatorField in o) {
      const c = toStr(o[mapping.creatorField]);
      if (c) item.creator = c;
    }
    if (mapping.yearField && mapping.yearField in o) {
      const y = toInt(o[mapping.yearField]);
      if (y) item.year = y;
    }
    if (mapping.providerField && mapping.providerField in o) {
      const p = toStr(o[mapping.providerField]);
      if (p) item.provider = p;
    }
    if (mapping.genreField && mapping.genreField in o) {
      const g = toStr(o[mapping.genreField]);
      if (g) item.genre = g;
    }
    if (mapping.citationUrlField && mapping.citationUrlField in o) {
      const u = toStr(o[mapping.citationUrlField]);
      if (u && /^https?:\/\//i.test(u)) item.citationUrl = u;
    }
    items.push(item);
  }

  items.sort((a, b) => a.rank - b.rank);
  return { items, mapping, arrayLength: arr.length, format: detected.format };
}

// ─── Format detection + parsing ─────────────────────────────

interface DetectResult {
  array: Record<string, unknown>[];
  format: "json" | "tsv" | "csv";
  topLevelKeys?: string;
}

function detectAndParse(rawText: string, contentType: string, url: string): DetectResult {
  const trimmed = rawText.trimStart();
  const lowerCT = contentType.toLowerCase();
  const lowerUrl = url.toLowerCase();

  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[") || lowerCT.includes("json");
  const looksTsv = lowerCT.includes("tab-separated") || lowerUrl.endsWith(".tsv");
  const looksCsv = lowerCT.includes("csv") || lowerUrl.endsWith(".csv");

  if (looksJson) {
    try {
      const parsed = JSON.parse(rawText);
      const arr = findLargestArrayOfObjects(parsed);
      if (!arr) throw new Error("No array of objects in JSON.");
      const topLevelKeys = Array.isArray(parsed)
        ? "(bare array)"
        : Object.keys(parsed as Record<string, unknown>).join(", ");
      return { array: arr, format: "json", topLevelKeys };
    } catch (e) {
      if (looksTsv || looksCsv) {
        // fall through to delimiter parsing
      } else {
        throw new Error(
          `JSON parse failed: ${e instanceof Error ? e.message : "unknown"}`,
        );
      }
    }
  }

  // Fall back to delimited parsing. Decide which delimiter wins on the first line.
  const firstNewline = rawText.indexOf("\n");
  const headerLine = firstNewline >= 0 ? rawText.slice(0, firstNewline) : rawText;
  const tabCount = (headerLine.match(/\t/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const delimiter = looksTsv || tabCount >= commaCount ? "\t" : ",";

  const rows = parseDelimited(rawText, delimiter);
  if (rows.length < 2) throw new Error("Source has no data rows after header.");
  const headers = rows[0]!;
  const objs: Record<string, unknown>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 1 && row[0] === "") continue; // blank
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]!] = row[j] ?? "";
    }
    objs.push(obj);
  }
  return { array: objs, format: delimiter === "\t" ? "tsv" : "csv" };
}

/** Minimal RFC-4180-ish delimited parser. Handles quoted fields with embedded
 *  delimiters / newlines / doubled quotes. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      // collapse \r\n
      if (ch === "\r" && text[i + 1] === "\n") i += 2;
      else i++;
      continue;
    }
    field += ch;
    i++;
  }
  // flush last field
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ─── Column sniff (token-cheap sample for Claude) ───────────

/** Build a compact "column: example values" sniff from up to 3 sample rows. */
function buildColumnSniff(arr: Record<string, unknown>[]): string {
  const cols = Object.keys(arr[0]!);
  const samples = arr.slice(0, 3);
  const lines: string[] = [];
  for (const col of cols) {
    const examples = samples
      .map((s) => truncate(coerceForSample(s[col]), 80))
      .filter((v) => v !== "")
      .slice(0, 3);
    lines.push(`${col}: ${examples.length ? examples.map((e) => JSON.stringify(e)).join(" | ") : "(empty)"}`);
  }
  return lines.join("\n");
}

function coerceForSample(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "[unrenderable]";
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

// ─── Claude field-mapping call ──────────────────────────────

export interface FieldMapping {
  rankField: string | null;
  nameField: string;
  creatorField: string | null;
  yearField: string | null;
  providerField: string | null;
  genreField: string | null;
  citationUrlField: string | null;
}

const SYSTEM_PROMPT = `You are inspecting a tabular dataset (parsed from JSON, TSV, or CSV) to identify which columns contain ranked-list metadata.

You receive a description of the source format and a "column: sample values" sniff. Return ONLY a JSON object with EXACTLY these keys:

{
  "rankField": "<column holding rank/position> or null if items have no rank field (we'll use array order)",
  "nameField": "<column holding the primary subject — album, song, film, book, game title, etc.>",
  "creatorField": "<column holding artist/director/author/developer/etc.> or null",
  "yearField": "<column holding release/publication year> or null",
  "providerField": "<column holding label/publisher/studio/network> or null",
  "genreField": "<column holding genre/category/type> or null",
  "citationUrlField": "<column holding a canonical reference URL (Wikipedia, etc.) — pick the most authoritative if multiple URL columns exist> or null"
}

Rules:
- Use the EXACT column names, including casing.
- nameField is REQUIRED — pick the best primary-subject column even when ambiguous.
- All other fields default to null when absent.
- For citationUrl, prefer Wikipedia URLs over rating/review site URLs when both exist.
- Output ONLY the JSON object — no prose, no fences.`;

async function askClaudeForMapping(
  apiKey: string,
  topShape: string,
  columnSniff: string,
): Promise<FieldMapping> {
  const client = new Anthropic({ apiKey, timeout: 30_000 });
  const userMsg = `SOURCE: ${topShape}

COLUMNS:
${columnSniff}

Return the mapping JSON.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });

  const textOut = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return parseMappingJSON(textOut);
}

function parseMappingJSON(text: string): FieldMapping {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Claude returned no parseable mapping JSON: ${stripped.slice(0, 120)}`);
  }
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error(`Claude mapping JSON did not parse: ${stripped.slice(0, 120)}`);
  }
  const nameField = typeof obj["nameField"] === "string" ? obj["nameField"] : "";
  if (!nameField) throw new Error("Claude mapping missing required nameField");

  const strOrNull = (k: string): string | null =>
    typeof obj[k] === "string" && (obj[k] as string).length > 0 ? (obj[k] as string) : null;

  return {
    rankField: strOrNull("rankField"),
    nameField,
    creatorField: strOrNull("creatorField"),
    yearField: strOrNull("yearField"),
    providerField: strOrNull("providerField"),
    genreField: strOrNull("genreField"),
    citationUrlField: strOrNull("citationUrlField"),
  };
}

// ─── Array auto-discovery (JSON only) ───────────────────────

function findLargestArrayOfObjects(node: unknown): Record<string, unknown>[] | null {
  let best: Record<string, unknown>[] | null = null;
  function isObjectArray(arr: unknown[]): boolean {
    if (arr.length === 0) return false;
    const sample = arr[0];
    return !!sample && typeof sample === "object" && !Array.isArray(sample);
  }
  function scan(n: unknown): void {
    if (Array.isArray(n)) {
      if (isObjectArray(n) && (!best || n.length > best.length)) {
        best = n as Record<string, unknown>[];
      }
      for (const child of n) scan(child);
    } else if (n && typeof n === "object") {
      for (const child of Object.values(n as Record<string, unknown>)) scan(child);
    }
  }
  scan(node);
  return best;
}

// ─── Coercion helpers ───────────────────────────────────────

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string") {
    const m = v.match(/-?\d+/);
    if (m) {
      const n = Number.parseInt(m[0], 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}
