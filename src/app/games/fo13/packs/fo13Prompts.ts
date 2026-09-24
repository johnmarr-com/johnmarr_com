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

Write 10 subject cards.

HARD RULES
- Plural. Every card must accept the verbs "are" and "have" with no editing.
- Never use "one in X" or "the average X" (singular). Use "2 of every 11", "3 in 5", "30% of", "most", "all", "nearly all", "several", "at least two", "an undisclosed number of", or no quantifier at all.
- 30 characters or fewer, including spaces.
- No terminal punctuation. No quotation marks.
- Capitalize as a normal phrase would be capitalized ("Most Norwegian gorillas", "Turkish dentists", "30% of Himalayan eels").
- No real named people, brands, franchises, or trademarked characters.
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
- Mix animals, professions, hobbyists, regional groups, household categories, and institutional groups ("night-shift lighthouse keepers", "municipal parking enforcers", "left-handed cellists").
- No two cards in the batch may share the same animal, profession, or nationality.

Do not produce anything resembling: {{existing}}

Return ONLY a JSON array of exactly 10 strings. No commentary.`;

const RESEARCH = `You write research cards for a deadpan party card game. Each card is a predicate that follows a random PLURAL subject card and is often followed by a random footnote card. Example completed sentence:
"2 of every 11 elephants / are deathly afraid of sidewalk cracks / due to childhood trauma"

Write 10 research cards.

HARD RULES
- Must grammatically follow ANY plural subject. Write in plural present tense: "are afraid of", "have never seen", "cannot pronounce", "refuse to", "secretly collect", "have been known to". Test each card against "Most librarians ___" and "30% of eels ___" — it must work for both.
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
- Vary the register: clinical ("exhibit a mild allergy to"), bureaucratic ("are not authorized to"), and plain ("keep a spare lasagna in the trunk").
- It should read like something sad, small, and specific that nobody at the office noticed was funny.

VARIETY IN EACH BATCH OF 10
- 2 fears or aversions
- 2 beliefs or misconceptions ("believe the moon is rented")
- 2 habits or behaviors
- 2 abilities or inabilities
- 2 possessions, physical traits, or statuses ("are legally classified as furniture")
- No two cards may share a main verb.

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

THREE TYPES — EACH BATCH OF 10 MUST INCLUDE
- 4 WHY (motive or cause): "for the love of fame", "for personal reasons", "due to childhood trauma", "simply for the thrill of it", "for tax purposes", "on a dare from a priest"
- 3 WHEN (schedule or condition): "every Tuesday at noon", "every September", "at least twice a week", "only during business hours", "until further notice"
- 3 COLOR (qualifier or twist): "but never admit it", "but are not aware of it", "and are proud of it", "with sweet and sour sauce", "while maintaining eye contact"
- No two cards may share the same opening word.

Do not produce anything resembling: {{existing}}

Return ONLY a JSON array of exactly 10 strings. No commentary.`;

const PROMPTS: Record<FO13GeneratedCardType, string> = {
  Subject: SUBJECT,
  Research: RESEARCH,
  Footnote: FOOTNOTE,
};

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
  return PROMPTS[cardType].replace("{{existing}}", rendered);
}
