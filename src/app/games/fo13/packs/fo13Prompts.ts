/**
 * Field Office 13 card-writing prompts.
 *
 * One prompt per typed card kind. A completed sentence reads across three
 * cards — subject / research / footnote:
 *
 *   "2 of every 11 elephants / are deathly afraid of sidewalk cracks /
 *    due to childhood trauma"
 *
 * Each prompt ends by asking for a bare JSON array of 10 strings, and takes
 * the pack's existing cards of that kind so a second run does not repeat the
 * first. Rank cards ship with the game and are never generated.
 */

import type { FO13CardType } from "@/lib/fo13-packs";

/** The card kinds that can be written by AI. */
export type FO13GeneratedCardType = Exclude<FO13CardType, "Rank">;

export const FO13_GENERATED_CARD_TYPES: FO13GeneratedCardType[] = [
  "Subject",
  "Research",
  "Footnote",
];

export function isGeneratedCardType(
  cardType: string,
): cardType is FO13GeneratedCardType {
  return (FO13_GENERATED_CARD_TYPES as string[]).includes(cardType);
}

/** How many cards one run asks for. */
export const FO13_GENERATION_COUNT = 10;

const SUBJECT = `You write subject cards for a deadpan party card game. Each card is a plural noun phrase — a population — that will be followed by a "research" card (a predicate) and often a "footnote" card. Example completed sentence:
"2 of every 11 elephants / are deathly afraid of sidewalk cracks / due to childhood trauma"

Field Office 13 is the bureau that investigates the unexplained and the utterly ordinary with exactly equal seriousness. Its filing cabinets hold Danish locksmiths and lake monsters in the same drawer, alphabetized. That flatness is the joke: nobody at this office has noticed that half their caseload is impossible.

Write 10 subject cards.

HARD RULES
- Plural. Every card must accept the verbs "are" and "have" with no editing.
- Never use "one in X" or "the average X" (singular). Use "2 of every 11", "3 in 5", "30% of", "most", "all", "nearly all", "several", "at least two", "an undisclosed number of", or no quantifier at all.
- 30 characters or fewer, including spaces.
- No terminal punctuation. No quotation marks.
- Capitalize as a normal phrase would be capitalized ("Most Norwegian gorillas", "Turkish dentists", "30% of Himalayan eels").
- No real named people, brands, franchises, or trademarked characters.
- Folklore is public domain and encouraged: Bigfoot, yetis, lake monsters, mothmen, jackalopes, chupacabras, sea serpents, ghosts, poltergeists, gnomes, fairies, oracles, hollow-earth dwellers, cursed objects, haunted infrastructure. Authored or trademarked creatures are not — nothing from a film, franchise, or novel.
- Living religions, their figures, and their practitioners are not material. Cryptids and defunct folklore are.
- Cryptid populations obey every rule above: still plural, still take "are" and "have", still 30 characters or fewer. "Sasquatches", "most yetis", "3 in 5 lake monsters", "Appalachian Bigfoot", "Nearly all bridge trolls".
- No slurs, no ethnic or religious stereotypes as the joke, no disability as the joke. Nationality + profession + animal combinations are fine as pure absurdity ("Belgian llama farmers"); the joke must never be that a group is inferior.

VOICE
- The tone is a government statistics bureau reporting findings with total seriousness. Clinical, specific, never winking.
- Specificity is the comedy. "Retired Finnish beekeepers" beats "old people". "2 of every 11" beats "some". Precise numbers imply someone counted.
- Aim for ordinary populations with one odd modifier, not stacks of absurdity. One strange element per card.
- The subject should be neutral enough that almost any predicate can follow it. Do not build the joke into the subject; the subject sets the table.

VARIETY IN EACH BATCH OF 10
- 3 with a numeric quantifier (percent, fraction, "X of every Y")
- 3 with a word quantifier ("most", "all", "nearly all", "several", "an undisclosed number of")
- 4 with no quantifier — a bare plural population

A SECOND, INDEPENDENT SPLIT — same 10 cards
- 4 cryptid, folkloric, or paranormal populations ("Sasquatches", "most lake monsters", "suburban poltergeists", "retired oracles", "nearly all bridge trolls", "3 in 5 haunted lighthouses")
- 6 ordinary populations — animals, professions, hobbyists, regional groups, household categories, institutional groups ("night-shift lighthouse keepers", "municipal parking enforcers", "left-handed cellists")
- The two splits are independent: a cryptid card can carry any quantifier type, and should.
- No two cards in the batch may share the same animal, profession, nationality, or creature.
- Range widely. A batch that is all forest cryptids, or all European professions, has failed even if every card is good.{{angles}}

Do not produce anything resembling: {{existing}}

Return ONLY a JSON array of exactly 10 strings. No commentary.`;

const RESEARCH = `You write research cards for a deadpan party card game. Each card is a predicate that follows a random PLURAL subject card and is often followed by a random footnote card. Example completed sentence:
"2 of every 11 elephants / are deathly afraid of sidewalk cracks / due to childhood trauma"

Field Office 13 is the bureau that investigates the unexplained and the utterly ordinary with exactly equal seriousness. Its subject cards run from municipal surveyors to lake monsters, and a research card has to sit on either one without blinking.

Write 10 research cards.

HARD RULES
- Must grammatically follow ANY plural subject. Write in plural present tense: "are afraid of", "have never seen", "cannot pronounce", "refuse to", "secretly collect", "have been known to". Test each card against "Most librarians ___", "30% of eels ___", and "Several lake monsters ___" — it must work for all three.
- Do not include the subject or any pronoun for it (no "they", "their", "themselves"... exception: "themselves" is allowed only when unavoidable).
- 40 characters or fewer, including spaces.
- Start lowercase. No terminal punctuation. No quotation marks.
- Leave room for a footnote. Do NOT include a reason ("because...", "for...", "due to..."), a time ("every Tuesday", "on weekends"), or a trailing qualifier ("but never admit it"). End on the object of the action so a footnote can attach cleanly.
- No real named people, brands, franchises, or trademarked characters.
- Keep it clean-adjacent: mild body humor is allowed in at most 1 of 10; no sexual content, no slurs, no cruelty toward real groups.

VOICE
- Findings from a government statistics office, reported flatly. The joke is a strange fact stated as routine.
- Specific beats absurd: "cannot spell falafel" beats "are weird". "have a third, degenerate kidney" beats "are gross". Name the exact object, the exact fear, the exact skill.
- One odd element per card. Mundane verb + strange object, or strange verb + mundane object. Not both.
- The best cards are funniest precisely because they are indiscriminate. "cannot be photographed" is a shrug on a Sasquatch and a catastrophe on a dental hygienist — write for that second reading.
- Vary the register: clinical ("exhibit a mild allergy to"), bureaucratic ("are not authorized to"), and plain ("keep a spare lasagna in the trunk").
- It should read like something sad, small, and specific that nobody at the office noticed was funny.

VARIETY IN EACH BATCH OF 10
- 2 fears or aversions
- 2 beliefs or misconceptions ("believe the moon is rented")
- 2 habits or behaviors
- 2 abilities or inabilities
- 2 possessions, physical traits, or statuses ("are legally classified as furniture")
- Cutting across those five: 3 of the 10 carry a paranormal or uncanny edge ("cannot be photographed", "do not appear in mirrors", "molt every seventh year", "predate the county"). These must still land on librarians — the comedy is the bureau applying them to everyone.
- No two cards may share a main verb.
- Range widely across registers and subject matter. A batch that is all office humor, or all monster jokes, has failed.{{angles}}

Do not produce anything resembling: {{existing}}

Return ONLY a JSON array of exactly 10 strings. No commentary.`;

const FOOTNOTE = `You write footnote cards for a deadpan party card game. A footnote is an OPTIONAL trailing phrase that attaches to the end of a random plural subject + research sentence and changes its meaning. Example completed sentence:
"2 of every 11 elephants / are deathly afraid of sidewalk cracks / due to childhood trauma"

Write 10 footnote cards.

HARD RULES
- Must attach cleanly to the END of almost any predicate. Test each card against "...are afraid of sidewalk cracks ___", "...cannot spell falafel ___", and "...keep a spare lasagna in the trunk ___". It must read as English after all three.
- Never contain a verb that needs its own subject. Use prepositional phrases, adverbials, participles, and "but"-clauses only: "for tax purposes", "every Tuesday at noon", "but never admit it", "while sobbing", "against medical advice".
- 40 characters or fewer, including spaces.
- Start lowercase. No terminal punctuation. No quotation marks.
- No real named people, brands, franchises, or trademarked characters.
- No sexual content, no slurs.

VOICE
- The footnote is where a finding goes wrong. The research is the fact; the footnote is the detail that shouldn't have been in the report.
- Deadpan and bureaucratic. "for reasons that will be explained later" beats "lol".
- The best footnotes work against many predicates because they redirect rather than punchline: they supply a motive, a schedule, a condition, or a small betrayal.
- Prefer phrases that imply a larger untold story: "since the incident", "pending the outcome of the appeal", "as instructed".
- Field Office 13 investigates cryptids and county paperwork with the same flat tone, so its footnotes range across both: "since the sighting", "pending Bureau review", "only during a full moon", "per the settlement with the lake", "but the photographs are blurry". Mix these with the purely clerical ones — a batch of all spooky or all bureaucratic has failed.

THREE TYPES — EACH BATCH OF 10 MUST INCLUDE
- 4 WHY (motive or cause): "for the love of fame", "for personal reasons", "due to childhood trauma", "simply for the thrill of it", "for tax purposes", "on a dare from a priest"
- 3 WHEN (schedule or condition): "every Tuesday at noon", "every September", "at least twice a week", "only during business hours", "until further notice"
- 3 COLOR (qualifier or twist): "but never admit it", "but are not aware of it", "and are proud of it", "with sweet and sour sauce", "while maintaining eye contact", "but the footage is inconclusive"
- No two cards may share the same opening word.{{angles}}

Do not produce anything resembling: {{existing}}

Return ONLY a JSON array of exactly 10 strings. No commentary.`;

const PROMPTS: Record<FO13GeneratedCardType, string> = {
  Subject: SUBJECT,
  Research: RESEARCH,
  Footnote: FOOTNOTE,
};

/**
 * Territory to push each batch toward.
 *
 * These are the variety lever. The model rejects `temperature` outright, so
 * two runs of an identical prompt drift toward the same comfortable middle —
 * forest cryptids and office humour. Rotating a few angles per call moves the
 * batch somewhere else instead. They name a subject area, never a word to
 * use, so the model still writes the joke.
 */
const ANGLES: Record<FO13GeneratedCardType, readonly string[]> = {
  Subject: [
    "deep water and whatever lives in it",
    "high altitude and thin air",
    "suburban domestic life",
    "municipal infrastructure and the people who maintain it",
    "the night shift",
    "deep forest and the things reportedly in it",
    "collectors, hobbyists, and enthusiast clubs",
    "livestock, pets, and working animals",
    "cold climates and polar stations",
    "deserts and dry country",
    "transit — ferries, trams, tunnels, bridges",
    "academia and very small museums",
    "the retired, of any occupation",
    "haunted objects and haunted buildings",
    "creatures known only from a single photograph",
    "the very small — insects, rodents, garden fauna",
    "islands and coastal towns",
    "weather and the people who measure it",
  ],
  Research: [
    "perception and the senses",
    "documentation, records, and paperwork",
    "food and eating",
    "sleep and dreams",
    "language and pronunciation",
    "money and commerce",
    "law and official classification",
    "physical anomalies",
    "navigation and direction",
    "time and calendars",
    "music and sound",
    "grooming and appearance",
    "fear and avoidance",
    "collecting and hoarding",
    "photography and being recorded",
    "weather sensitivity",
  ],
  Footnote: [
    "legal and financial motive",
    "seasonal and calendar timing",
    "institutional procedure",
    "family and inheritance",
    "an unresolved incident",
    "physical conditions and weather",
    "secrecy and denial",
    "pride and the public record",
    "medical advice, taken or ignored",
    "supervision and its absence",
    "wagers, dares, and bets",
    "the terms of a settlement",
  ],
};

/** How many angles each run is pushed toward. */
const ANGLES_PER_RUN = 3;

/** Pick n distinct entries at random (partial Fisher-Yates). */
function pickAngles(pool: readonly string[], n: number): string[] {
  const copy = [...pool];
  const take = Math.min(n, copy.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
  }
  return copy.slice(0, take);
}

/**
 * The prompt for one card kind, with the pack's existing cards of that kind
 * substituted in so a repeat run writes something new.
 */
export function fo13Prompt(
  cardType: FO13GeneratedCardType,
  existing: readonly string[],
): string {
  const lines = existing
    .map((line) => line.trim())
    .filter(Boolean)
    // Newest cards are the ones most worth avoiding, and the list is
    // bounded so a big pack can't crowd out the instructions.
    .slice(-120);
  const rendered = lines.length > 0 ? lines.join(" | ") : "(nothing yet)";
  const angles = pickAngles(ANGLES[cardType], ANGLES_PER_RUN);
  return PROMPTS[cardType]
    .replace("{{existing}}", rendered)
    .replace(
      "{{angles}}",
      `\n- Territory for THIS batch — reach into ${angles.join("; ")}. These are areas to explore, not words to use, and they do not replace the splits above.`,
    );
}
