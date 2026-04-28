# Fast Casual Trivia — Content Research Agent

## Build Spec for Claude Code / Cursor

---

## Overview

This document specifies the first buildable element of John Marr's Fast
Casual Trivia platform: the **Content Research Agent.** This agent lives
inside the Inventing.Studio on JohnMarr.com and is responsible for
populating the trivia content database with prioritized, tagged, cited
subjects across all twelve trivia verticals.

The agent does ONE job: find the most popular, most culturally relevant
subjects for each trivia vertical, store them in Firebase with citations
and tags, and track pagination so it can resume where it left off.

A separate downstream agent (not in this spec) will later read these
subjects and generate T/PT/F question pairs, writing them to Neon.

---

## Architecture Context

### Where This Lives

The Inventing.Studio is an existing dropdown/panel on JohnMarr.com.
Inside it, add a new page: **AI Agents.**

The AI Agents page is **tabbed.** The first (and currently only) tab
is **Trivia.** Future tabs may include Mysteries, Content, etc.

### The Trivia Tab Layout (top to bottom)

```
┌─────────────────────────────────────────────────────┐
│  AI Agents                                          │
│  [Trivia]  [future tab]  [future tab]               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ DASHBOARD GRID (4x3) ────────────────────────┐  │
│  │  Nabster: 0/500    OutTakes: 0/500            │  │
│  │  Plated: 0/500     Extra Extra: 0/500         │  │
│  │  Pwn Stars: 0/500  1st Ed.: 0/500             │  │
│  │  Geek Freak: 0/500 Ctrl Alt Defeat: 0/500    │  │
│  │  Paparazza: 0/500  Pop Wow: 0/500             │  │
│  │  Season Tix: 0/500 Where In The: 0/500        │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ TAGS (collapsed by default) ─────────────────┐  │
│  │  ▶ Tags (47 tags across 8 categories)         │  │
│  │    [expanded view shows live tag generation]   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ AGENT ASSIGNMENT ────────────────────────────┐  │
│  │  Game: [dropdown: 12 options]                 │  │
│  │  Source URL: [text input, optional]            │  │
│  │  API Key: [text input, optional, shown         │  │
│  │            only when Source URL is provided]    │  │
│  │                                                │  │
│  │  [▶ Run Agent]                                │  │
│  │                                                │  │
│  │  ┌─ Live Activity Log ─────────────────────┐  │  │
│  │  │  [streaming agent output as it works]   │  │  │
│  │  │  Found: "Achtung Baby" — U2             │  │  │
│  │  │  Tags: decade:1990s, genre:alternative  │  │  │
│  │  │  Citations: 2 sources                   │  │  │
│  │  │  Found: "Thriller" — Michael Jackson    │  │  │
│  │  │  Tags: decade:1980s, genre:pop          │  │  │
│  │  │  ...                                    │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Section 1: Dashboard Grid

### Layout

A 4-column, 3-row grid displaying all twelve trivia verticals. Each
cell is compact — one short row per game.

### Cell Content

Each cell displays:

```
[Game Icon] Game Name: {count} / 500
```

- **Game Icon**: Small (20x20) icon or colored dot matching the game's
  brand color
- **Game Name**: The vertical name (Nabster, OutTakes, etc.)
- **Count**: Live count of subjects in Firebase for this gameId
- **/ 500**: Target count (static, shows progress toward goal)

### Color Coding

- 0 items: default/gray text
- 1–99: red/orange (just started)
- 100–299: yellow (in progress)
- 300–499: blue (nearly complete)
- 500: green (target reached)

### Data Source

Read count from Firebase collection `trivia-content` grouped by `gameId`.

```typescript
// Real-time listener for counts
const counts = {}
for (const theme of ALL_THEMES) {
  const snapshot = await db.collection('trivia-content')
    .where('gameId', '==', theme)
    .count()
    .get()
  counts[theme] = snapshot.data().count
}
```

### Game IDs (enum values used throughout the system)

```typescript
enum TriviaGameId {
  NABSTER         = 'nabster',
  OUTTAKES        = 'outtakes',
  PLATED          = 'plated',
  EXTRA_EXTRA     = 'extra_extra',
  PWN_STARS       = 'pwn_stars',
  FIRST_ED        = 'first_ed',
  GEEK_FREAK      = 'geek_freak',
  CTRL_ALT_DEFEAT = 'ctrl_alt_defeat',
  PAPARAZZA       = 'paparazza',
  POP_WOW         = 'pop_wow',
  SEASON_TIX      = 'season_tix',
  WHERE_IN_THE    = 'where_in_the',
}
```

Display names for the grid:

```typescript
const GAME_DISPLAY_NAMES: Record<TriviaGameId, string> = {
  nabster:         'Nabster',
  outtakes:        'OutTakes',
  plated:          'Plated',
  extra_extra:     'Extra Extra',
  pwn_stars:       'Pwn Stars',
  first_ed:        '1st Ed.',
  geek_freak:      'Geek Freak',
  ctrl_alt_defeat: 'Ctrl Alt Defeat',
  paparazza:       'Paparazza',
  pop_wow:         'Pop Wow',
  season_tix:      'Season Tix',
  where_in_the:    'Where In The',
}
```

---

## Section 2: Tags Panel

### Layout

A collapsible row between the Dashboard Grid and the Agent Assignment
area. Collapsed by default.

### Collapsed State

```
▶ Tags (47 tags across 8 categories)
```

The numbers update in real time as the agent generates tags.

### Expanded State

When expanded, shows all tags grouped by category. Each tag displays
its usage count — how many subjects have been assigned that tag.

```
▼ Tags (47 tags across 8 categories)

  decade (8)
    1950s (12)  1960s (34)  1970s (45)  1980s (67)
    1990s (89)  2000s (56)  2010s (43)  2020s (21)

  genre (14)
    rock (45)  pop (67)  hip_hop (34)  alternative (28)
    jazz (12)  electronic (18)  country (15)  r_and_b (22)
    classical (8)  metal (11)  folk (9)  soul (14)
    punk (7)  reggae (5)

  region (6)
    north_america (120)  europe (89)  asia (34)
    latin_america (23)  africa (12)  oceania (8)

  [... more categories as the agent creates them]
```

### Tag Rendering

Tags are displayed as pills/chips with the count as a small badge.
Categories are collapsible subsections within the expanded panel.

### Data Source

Tags are stored on each subject document in Firebase AND maintained
in a separate `trivia-tags` collection for fast aggregate display.

```typescript
// trivia-tags collection structure
{
  category: 'decade',        // tag category
  value: '1990s',            // tag value
  count: 89,                 // number of subjects with this tag
  gameIds: ['nabster', 'outtakes', 'pop_wow'],  // which verticals use it
  createdAt: Timestamp,
  lastUsedAt: Timestamp,
}
```

---

## Section 3: Agent Assignment

### Inputs

**Game Dropdown** (required)
- Label: "Game"
- Options: All 12 TriviaGameId values with display names
- Default: No selection (placeholder: "Select a trivia game")

**Source URL** (optional)
- Label: "Source URL"
- Placeholder: "API endpoint or website URL (leave blank for free search)"
- When blank: Agent uses free search — it will search across any
  available source (Wikipedia, databases, general web) to find the
  most popular subjects for the selected vertical.
- When provided: Agent targets this specific API or site for data
  extraction.

**API Key** (optional, conditionally visible)
- Label: "API Key"
- Placeholder: "Enter API key if required"
- Visibility: Only shown when Source URL has a value
- Type: password input (masked)

**Run Button**
- Label: "▶ Run Agent"
- Disabled state: When no game is selected
- Active state: When game is selected (source URL optional)
- Running state: Shows spinner, label changes to "⏸ Running..."
  with option to pause/stop

### Live Activity Log

Below the Run button, a scrolling log area streams agent activity
in real time. Each log entry is a single line showing what the agent
found, what tags it assigned, and how many citations it captured.

```
[12:04:01] Searching: top albums by popularity...
[12:04:03] Found: "Thriller" — Michael Jackson
           Tags: decade:1980s, genre:pop, region:north_america
           Citations: Wikipedia, AllMusic
           Popularity: #1
[12:04:05] Found: "Back in Black" — AC/DC
           Tags: decade:1980s, genre:rock, region:oceania
           Citations: Wikipedia, Discogs
           Popularity: #2
[12:04:06] Saved 2 items. Total nabster: 2/500
[12:04:07] Continuing search from page 2...
```

The log auto-scrolls but allows manual scroll-up to review history.

---

## Section 4: Firebase Data Model

### Collection: `trivia-content`

Each document represents one researched subject (an album, a movie,
a dish, a historical event, etc.)

```typescript
interface TriviaContentDoc {
  // Identity
  id: string                      // auto-generated document ID
  gameId: TriviaGameId            // which trivia vertical
  name: string                    // "Achtung Baby"
  subtitle: string                // "U2" (artist, director, author, etc.)

  // Popularity & Tiering
  popularityRank: number          // position in popularity sort (1 = most popular)
  tier: 1 | 2 | 3                // 1=universal, 2=fluent, 3=deep cut
  // Tier assignment:
  //   Top 10% of items = Tier 1
  //   Next 25% = Tier 2
  //   Remaining = Tier 3

  // Source tracking
  sourceDb: string                // 'musicbrainz', 'tmdb', 'wikipedia', 'free_search'
  sourceId: string | null         // external ID for deduplication
  sourceUrl: string | null        // direct link to source page

  // Citations (useful for downstream question research)
  citations: Citation[]           // collected source URLs for this subject
  // These citations are starting points for the question-forming
  // agent to research narrative facts about this subject.

  // Tags (built dynamically by the agent)
  tags: Record<string, string>    // { "decade": "1990s", "genre": "alternative" }
  // Tags are freeform key-value pairs. The agent creates tag
  // categories and values as it discovers appropriate groupings
  // for each vertical. See Tag System section below.

  // Cross-vertical tags (for cross-game search)
  crossTags: Record<string, string> | null
  // { "subject_person": "spielberg", "subject_era": "1990s" }
  // These enable cross-vertical sessions where a player can
  // search "Spielberg" and get questions from OutTakes, Nabster,
  // Pop Wow, etc.

  // Pagination / Resumability
  sourcePageIndex: number         // which page of API results this came from
  // The agent tracks this so it can resume from where it left off
  // if interrupted.

  // Metadata
  status: 'indexed' | 'ready'    // indexed = found, ready = citations gathered
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface Citation {
  name: string                    // "Wikipedia", "AllMusic", "Rolling Stone"
  url: string                     // full URL to the source page
  type: 'primary' | 'secondary'  // primary = structured DB, secondary = editorial
}
```

### Collection: `trivia-tags`

Aggregate tag tracking for the dashboard Tags panel.

```typescript
interface TriviaTagDoc {
  id: string                      // auto-generated
  category: string                // "decade", "genre", "region", etc.
  value: string                   // "1990s", "alternative", "north_america"
  count: number                   // total subjects with this tag
  gameIds: TriviaGameId[]         // which verticals use this tag
  createdAt: Timestamp
  lastUsedAt: Timestamp
}
```

### Collection: `trivia-agent-state`

Tracks agent progress for resumability.

```typescript
interface TriviaAgentStateDoc {
  id: string                      // same as gameId
  gameId: TriviaGameId
  sourceUrl: string | null        // the source being scraped
  lastPageIndex: number           // last completed page
  totalFound: number              // running count
  status: 'idle' | 'running' | 'paused' | 'complete'
  lastRunAt: Timestamp
  error: string | null            // last error if any
}
```

---

## Section 5: Tag System

### Philosophy

The agent builds the tag taxonomy itself. It is not given a fixed list
of tags. Instead, it is given the PRINCIPLE of how to tag, and it
creates categories and values as it encounters subjects.

This is intentional — different verticals will naturally develop
different tag structures. Nabster will have "genre" and "decade."
Where In The will have "continent" and "category." The agent should
discover these organically rather than being forced into a predefined
schema.

### Agent Tagging Instructions

Include these instructions in the agent's system prompt:

```
TAG SYSTEM INSTRUCTIONS

You are building a tag taxonomy for trivia content. Tags serve one
purpose: letting players filter and focus their trivia sessions.

For every subject you find, assign tags that would help a trivia
player find this subject when searching.

RULES:
1. Tags are key-value pairs: { "category": "value" }
2. Keep categories broad and reusable. Good: "decade", "genre",
   "region". Bad: "specific_year", "sub_sub_genre", "city_name".
3. A subject should have 2-5 tags. Not every category applies to
   every subject.
4. Before creating a new tag category, check if an existing one
   could work. Prefer reuse over invention.
5. Before creating a new tag value, check if a similar value exists.
   Use "1990s" consistently, not sometimes "90s" and sometimes
   "nineteen_nineties".
6. Tag values should be lowercase_snake_case.
7. Tag categories should be lowercase_snake_case.
8. Think like a trivia player: what would they type to find this?

CROSS-VERTICAL TAGS:
Some subjects span multiple trivia verticals. When a subject involves
a notable person, brand, era, or place that could appear in other
verticals, add crossTags:
- subject_person: "spielberg" (for people)
- subject_brand: "nasa" (for organizations/companies)
- subject_era: "cold_war" (for historical periods)
- subject_place: "hollywood" (for locations)

Cross tags enable a player to search "spielberg" and get questions
from OutTakes (directing career), Nabster (film scores), Pop Wow
(cultural impact), etc.

EXISTING TAGS:
{inject current tag list from trivia-tags collection here}

Use existing tags whenever possible. Only create new ones when
genuinely needed.
```

### Tag Synchronization

When the agent assigns tags to a subject, it also updates the
`trivia-tags` collection:

```typescript
async function syncTags(
  subject: TriviaContentDoc,
  db: FirebaseFirestore
) {
  for (const [category, value] of Object.entries(subject.tags)) {
    const tagQuery = await db.collection('trivia-tags')
      .where('category', '==', category)
      .where('value', '==', value)
      .limit(1)
      .get()

    if (tagQuery.empty) {
      // New tag — create it
      await db.collection('trivia-tags').add({
        category,
        value,
        count: 1,
        gameIds: [subject.gameId],
        createdAt: FieldValue.serverTimestamp(),
        lastUsedAt: FieldValue.serverTimestamp(),
      })
    } else {
      // Existing tag — increment count, add gameId if new
      const tagDoc = tagQuery.docs[0]
      await tagDoc.ref.update({
        count: FieldValue.increment(1),
        gameIds: FieldValue.arrayUnion(subject.gameId),
        lastUsedAt: FieldValue.serverTimestamp(),
      })
    }
  }
}
```

---

## Section 6: Agent Behavior

### Core Loop

The agent's job is simple and repeatable:

```
1. Read the selected gameId
2. Check trivia-agent-state for this gameId
   - If status = 'running', resume from lastPageIndex
   - If status = 'idle' or 'complete', start fresh or skip
3. Determine search strategy:
   - If Source URL provided: use that API/site
   - If blank: free search (Wikipedia, known DBs, general web)
4. Search for subjects, ordered by popularity
5. For each subject found:
   a. Check for duplicates (by sourceDb + sourceId, or by name + gameId)
   b. If new: create TriviaContentDoc in Firebase
   c. Assign tags (using existing tags where possible, creating new ones
      when genuinely needed)
   d. Sync tags to trivia-tags collection
   e. Gather citation URLs for downstream use
   f. Log activity to the Live Activity Log
6. Update trivia-agent-state with current page index
7. Continue until:
   - 500 subjects reached for this gameId, OR
   - Source is exhausted (no more results), OR
   - User pauses/stops the agent
```

### Search Strategy Per Vertical

When Source URL is blank (free search mode), the agent should
intelligently select sources based on the vertical. The agent should
use web search to find the best available sources for each vertical.

Suggested starting points (the agent can discover more):

| Game | Suggested Free Search Strategy |
|---|---|
| Nabster | Search for "greatest albums of all time lists", "most popular albums by decade", Wikipedia discography pages, AllMusic charts |
| OutTakes | Search for "highest grossing films of all time", "most acclaimed films", "iconic movie lists", TMDB popular endpoints |
| Plated | Search for "most famous dishes in the world", "iconic recipes by cuisine", Wikipedia food articles |
| Extra Extra | Search for "most important historical events", "turning points in history", Wikipedia history portals |
| Pwn Stars | Search for "greatest video games of all time lists", "most influential games", IGDB popular endpoints |
| 1st Ed. | Search for "greatest novels of all time", "most important books lists", Open Library popular |
| Geek Freak | Search for "greatest scientific discoveries", "most important inventions", NASA missions list |
| Ctrl Alt Defeat | Search for "history of computing milestones", "most important tech products", Computer History Museum |
| Paparazza | Search for "most famous celebrities", "biggest celebrity scandals", "iconic pop culture moments" |
| Pop Wow | Search for "defining pop culture moments by decade", "most viral cultural events" |
| Season Tix | Search for "greatest sports moments", "most famous athletes", "iconic games in sports history" |
| Where In The | Search for "most interesting countries", "surprising geography facts", "world records by country" |

### Popularity Prioritization

The agent MUST prioritize by popularity. The most universally known
subjects come first. This is critical for the Fast Casual Trivia
philosophy — the content should be accessible to everyone.

When using structured APIs, sort by the available popularity metric
(rating_count, vote_count, popularity score, etc.)

When using free search, prioritize subjects that appear on multiple
"greatest of all time" or "most popular" lists. Consensus across
multiple lists is a strong popularity signal.

### Tier Assignment

As subjects are collected, assign tiers based on position:

```typescript
function assignTier(rank: number, currentTotal: number): 1 | 2 | 3 {
  const targetTotal = 500
  const percentile = rank / targetTotal

  if (percentile <= 0.10) return 1   // Top 10% = universally known (50 items)
  if (percentile <= 0.35) return 2   // Next 25% = culturally fluent (125 items)
  return 3                            // Remaining = deep cut (325 items)
}
```

### Deduplication

Before writing a subject to Firebase, check:

```typescript
async function isDuplicate(
  gameId: string,
  name: string,
  sourceDb: string,
  sourceId: string | null,
  db: FirebaseFirestore
): Promise<boolean> {
  // Check by source ID first (most reliable)
  if (sourceId) {
    const bySourceId = await db.collection('trivia-content')
      .where('gameId', '==', gameId)
      .where('sourceDb', '==', sourceDb)
      .where('sourceId', '==', sourceId)
      .limit(1)
      .get()
    if (!bySourceId.empty) return true
  }

  // Fallback: check by name (fuzzy — lowercase, trimmed)
  const byName = await db.collection('trivia-content')
    .where('gameId', '==', gameId)
    .where('nameLower', '==', name.toLowerCase().trim())
    .limit(1)
    .get()
  return !byName.empty
}
```

Add a `nameLower` field to every TriviaContentDoc for case-insensitive
dedup matching.

### Resumability

The agent tracks its progress in `trivia-agent-state`. If the browser
closes, the connection drops, or the user navigates away, the agent
can resume exactly where it left off.

On Run:
1. Read `trivia-agent-state` for the selected gameId
2. If `lastPageIndex > 0` and `status !== 'complete'`:
   - Show confirmation: "Resume from item {lastPageIndex}? Or start fresh?"
3. If resuming: begin search from `lastPageIndex`
4. If starting fresh: reset `lastPageIndex` to 0

On every batch of subjects saved:
- Update `lastPageIndex` in `trivia-agent-state`
- Update `totalFound`
- Update `lastRunAt`

On completion (500 reached or source exhausted):
- Set `status = 'complete'`

On error:
- Set `error` field with error message
- Set `status = 'paused'`
- Agent stops gracefully
- User can hit Run again to resume

### Rate Limiting

The agent should respect API rate limits and avoid hammering any
single source:

- Minimum 1 second between API requests
- If a 429 (rate limit) response is received, back off exponentially:
  2s, 4s, 8s, 16s, then pause and ask user to retry later
- For Wikipedia, respect their API etiquette: identify with a
  User-Agent, limit to 200 requests/second (generous but be polite)
- Log rate limit events in the Activity Log

---

## Section 7: Agent System Prompt

The agent is powered by Claude (Anthropic API). The system prompt
should be constructed dynamically based on the selected vertical
and current tag state.

### System Prompt Template

```
You are a Content Research Agent for John Marr's Fast Casual Trivia.

YOUR JOB: Find the most popular, most culturally significant subjects
in the {GAME_DOMAIN} domain and return them as structured data.

BRAND CONTEXT:
Fast Casual Trivia's promise is "Trivia that tells stories."
Every subject you find will eventually become story-driven trivia
questions. Prioritize subjects that have rich, interesting stories
behind them — not just dry data points.

VERTICAL: {GAME_NAME} ({GAME_DOMAIN})
TARGET: Up to 500 subjects, ordered by popularity (most popular first)
CURRENT PROGRESS: {CURRENT_COUNT} subjects found so far
RESUME FROM: Page/offset {LAST_PAGE_INDEX}

{SOURCE_INSTRUCTIONS}
(If Source URL provided):
  Use this API/source: {SOURCE_URL}
  API Key: {API_KEY if provided}
  Extract subjects from this source, paginating through results
  ordered by popularity.

(If Source URL blank):
  Use free search. Find the most popular and culturally significant
  {GAME_DOMAIN} subjects. Search across Wikipedia, known databases,
  and curated lists. Prioritize subjects that appear on multiple
  "greatest of all time" or "most popular" lists.

FOR EACH SUBJECT FOUND, RETURN:
{
  "name": "The subject name",
  "subtitle": "The creator/artist/director/author/team",
  "popularityRank": 1,          // position in your results
  "sourceDb": "wikipedia",      // where you found it
  "sourceId": "Q12345",         // external ID if available
  "sourceUrl": "https://...",   // direct link
  "citations": [
    {
      "name": "Source Name",
      "url": "https://...",
      "type": "primary"         // or "secondary"
    }
  ],
  "tags": {
    "category": "value"         // see tag instructions below
  },
  "crossTags": {
    "subject_person": "name"    // if applicable, see below
  }
}

CITATIONS:
For every subject, collect 2-4 URLs where detailed narrative
information about this subject can be found. These citations will
be used by a downstream agent to research story-driven trivia facts.
Prioritize:
- Wikipedia article (almost always available)
- Specialized editorial source (AllMusic for music, TMDB for film, etc.)
- Long-form journalism or retrospective articles
Do NOT include social media, forums, or user-generated content.

{TAG_INSTRUCTIONS}
(Insert full tag system instructions from Section 5 above)

EXISTING TAGS IN THE SYSTEM:
{EXISTING_TAGS_JSON}

PRIORITY ORDER:
1. Most universally known subjects first (Tier 1)
2. Then culturally significant subjects (Tier 2)
3. Then deep cuts and niche subjects (Tier 3)

The goal is that the first 50 subjects you find should be things
virtually everyone would recognize. The next 125 should be things
enthusiasts know. The remaining 325 can be deeper cuts.

RESPONSE FORMAT:
Return a JSON array of subject objects. Return up to 20 subjects
per response. After returning, you will be called again to continue
from where you left off.

Return ONLY valid JSON. No preamble, no markdown, no commentary.
```

### Dynamic Prompt Construction

```typescript
function buildAgentPrompt(
  gameId: TriviaGameId,
  agentState: TriviaAgentStateDoc,
  existingTags: TriviaTagDoc[],
  sourceUrl: string | null,
  apiKey: string | null,
): string {
  const gameName = GAME_DISPLAY_NAMES[gameId]
  const gameDomain = GAME_DOMAINS[gameId]  // "Music", "Movies", etc.

  const tagInstructions = TAG_SYSTEM_INSTRUCTIONS  // from Section 5

  const existingTagsJson = JSON.stringify(
    existingTags.reduce((acc, tag) => {
      if (!acc[tag.category]) acc[tag.category] = []
      acc[tag.category].push(tag.value)
      return acc
    }, {} as Record<string, string[]>),
    null, 2
  )

  const sourceInstructions = sourceUrl
    ? `Use this API/source: ${sourceUrl}\n${apiKey ? `API Key: ${apiKey}` : ''}`
    : `Use free search across Wikipedia, known databases, and curated lists.`

  return SYSTEM_PROMPT_TEMPLATE
    .replace('{GAME_NAME}', gameName)
    .replace('{GAME_DOMAIN}', gameDomain)
    .replace('{CURRENT_COUNT}', String(agentState.totalFound))
    .replace('{LAST_PAGE_INDEX}', String(agentState.lastPageIndex))
    .replace('{SOURCE_INSTRUCTIONS}', sourceInstructions)
    .replace('{TAG_INSTRUCTIONS}', tagInstructions)
    .replace('{EXISTING_TAGS_JSON}', existingTagsJson)
}
```

### Game Domain Mapping

```typescript
const GAME_DOMAINS: Record<TriviaGameId, string> = {
  nabster:         'Music (albums, artists, songs, music history)',
  outtakes:        'Movies (films, directors, actors, production, box office)',
  plated:          'Food & Culinary (dishes, cuisines, chefs, restaurants, culinary history)',
  extra_extra:     'History & World Events (historical events, figures, movements, eras)',
  pwn_stars:       'Video Games (games, consoles, developers, gaming culture, esports)',
  first_ed:        'Literature (novels, authors, poetry, literary movements, publishing)',
  geek_freak:      'Science & Space (discoveries, inventions, space missions, scientists)',
  ctrl_alt_defeat: 'Computer & Tech History (hardware, software, internet, tech companies)',
  paparazza:       'Celebrity Gossip (celebrity lives, feuds, scandals, relationships)',
  pop_wow:         'Pop Culture (memes, viral moments, trends, cultural phenomena)',
  season_tix:      'Sports (athletes, games, records, championships, sports history)',
  where_in_the:    'Geography (countries, landmarks, borders, records, cultural geography)',
}
```

---

## Section 8: Agent Execution Flow

### Client-Side (React)

```typescript
// Simplified flow — adapt to your existing patterns

async function runAgent(
  gameId: TriviaGameId,
  sourceUrl: string | null,
  apiKey: string | null,
) {
  // 1. Load or create agent state
  let agentState = await loadAgentState(gameId)
  if (!agentState) {
    agentState = await createAgentState(gameId)
  }

  // 2. Load existing tags for the system prompt
  const existingTags = await loadAllTags()

  // 3. Update status to running
  await updateAgentState(gameId, { status: 'running' })

  // 4. Build the system prompt
  const systemPrompt = buildAgentPrompt(
    gameId, agentState, existingTags, sourceUrl, apiKey
  )

  // 5. Agent loop — call Claude repeatedly until done
  let continueRunning = true
  let pageIndex = agentState.lastPageIndex

  while (continueRunning) {
    try {
      // Call Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Find the next batch of subjects. Resume from position ${pageIndex + 1}. Current total: ${agentState.totalFound}/${500}.`
          }],
          // Enable web search for free search mode
          ...(sourceUrl ? {} : {
            tools: [{ type: 'web_search_20250305', name: 'web_search' }]
          }),
        }),
      })

      const data = await response.json()

      // Extract text content (may include tool use blocks for web search)
      const textContent = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('')

      // Parse the JSON response
      const subjects = JSON.parse(
        textContent.replace(/```json|```/g, '').trim()
      )

      // 6. Process each subject
      for (const subject of subjects) {
        // Dedup check
        const duplicate = await isDuplicate(
          gameId, subject.name, subject.sourceDb, subject.sourceId
        )
        if (duplicate) {
          logActivity(`Skipped duplicate: "${subject.name}"`)
          continue
        }

        // Assign tier based on current rank
        const tier = assignTier(subject.popularityRank, 500)

        // Write to Firebase
        const doc: TriviaContentDoc = {
          gameId,
          name: subject.name,
          nameLower: subject.name.toLowerCase().trim(),
          subtitle: subject.subtitle,
          popularityRank: subject.popularityRank,
          tier,
          sourceDb: subject.sourceDb,
          sourceId: subject.sourceId || null,
          sourceUrl: subject.sourceUrl || null,
          citations: subject.citations || [],
          tags: subject.tags || {},
          crossTags: subject.crossTags || null,
          sourcePageIndex: pageIndex,
          status: 'indexed',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }

        await db.collection('trivia-content').add(doc)

        // Sync tags
        await syncTags(doc, db)

        // Log activity
        const tagStr = Object.entries(subject.tags)
          .map(([k, v]) => `${k}:${v}`).join(', ')
        logActivity(
          `Found: "${subject.name}" — ${subject.subtitle}\n` +
          `  Tags: ${tagStr}\n` +
          `  Citations: ${subject.citations?.length || 0} sources\n` +
          `  Popularity: #${subject.popularityRank}`
        )

        agentState.totalFound++
      }

      // 7. Update agent state
      pageIndex += subjects.length
      await updateAgentState(gameId, {
        lastPageIndex: pageIndex,
        totalFound: agentState.totalFound,
        lastRunAt: FieldValue.serverTimestamp(),
        error: null,
      })

      // 8. Check stopping conditions
      if (agentState.totalFound >= 500) {
        logActivity(`Target reached: ${agentState.totalFound}/500`)
        await updateAgentState(gameId, { status: 'complete' })
        continueRunning = false
      }

      if (subjects.length === 0) {
        logActivity('Source exhausted — no more results')
        await updateAgentState(gameId, { status: 'complete' })
        continueRunning = false
      }

      // Rate limiting pause between batches
      await delay(2000)

      // Refresh existing tags for next prompt (tags may have grown)
      existingTags = await loadAllTags()

    } catch (error) {
      logActivity(`Error: ${error.message}`)
      await updateAgentState(gameId, {
        status: 'paused',
        error: error.message,
      })
      continueRunning = false
    }
  }
}
```

### Stopping / Pausing

The user can pause the agent at any time. The client sets a flag that
the loop checks between batches:

```typescript
let userRequestedStop = false

// Bound to the pause button
function pauseAgent() {
  userRequestedStop = true
}

// Inside the while loop, after processing each batch:
if (userRequestedStop) {
  logActivity('Agent paused by user')
  await updateAgentState(gameId, { status: 'paused' })
  continueRunning = false
}
```

---

## Section 9: Future — Question Designer Agent

This spec covers ONLY the Content Research Agent (Phase 1). The
Question Designer Agent (Phase 2) is a separate future build that will:

1. Read subjects from Firebase (`trivia-content`)
2. Fetch prose from each subject's citations
3. Extract narrative story-driven facts using Claude
4. Form T/PT/F question pairs using Claude
5. Write finished questions to Neon (Postgres)
6. Present questions in a review UI for human approval

The Question Designer Agent will have its own tab or sub-section
within the AI Agents page. It reads FROM the Firebase content that
this Research Agent creates.

The handoff point is the `trivia-content` collection in Firebase.
When a subject has `status: 'indexed'` and has citations, it is
ready for the Question Designer to pick up.

---

## Section 10: UI Component Specifications

### AI Agents Page

```typescript
// Page structure
<AIAgentsPage>
  <TabBar tabs={['Trivia', /* future tabs */]} />

  <TriviaTab>
    <DashboardGrid games={ALL_THEMES} counts={liveCounts} />
    <TagsPanel tags={liveTags} defaultCollapsed={true} />
    <AgentAssignment
      onRun={runAgent}
      onPause={pauseAgent}
      activityLog={logEntries}
      isRunning={agentRunning}
    />
  </TriviaTab>
</AIAgentsPage>
```

### Dashboard Grid Component

```typescript
interface DashboardGridProps {
  games: TriviaGameId[]
  counts: Record<TriviaGameId, number>
}

// Renders a 4-column responsive grid
// Each cell: [icon] Name: count/500
// Color-coded by progress (see Section 1)
// Real-time updates via Firestore onSnapshot
```

### Tags Panel Component

```typescript
interface TagsPanelProps {
  tags: TriviaTagDoc[]
  defaultCollapsed: boolean
}

// Collapsed: "▶ Tags (N tags across M categories)"
// Expanded: Tags grouped by category, each as a pill with count badge
// Real-time updates as agent creates new tags
```

### Agent Assignment Component

```typescript
interface AgentAssignmentProps {
  onRun: (gameId: TriviaGameId, sourceUrl?: string, apiKey?: string) => void
  onPause: () => void
  activityLog: LogEntry[]
  isRunning: boolean
}

// Game dropdown (required)
// Source URL input (optional)
// API Key input (conditional on Source URL)
// Run/Pause button
// Live Activity Log (scrolling, auto-scroll with manual override)
```

### Activity Log Entry

```typescript
interface LogEntry {
  timestamp: Date
  type: 'info' | 'found' | 'error' | 'complete' | 'skipped'
  message: string
  tags?: Record<string, string>
  citations?: number
  rank?: number
}
```

---

## Summary

### What gets built

1. AI Agents page in the Inventing.Studio
2. Trivia tab with three sections:
   - Dashboard Grid (12 games, live counts)
   - Tags Panel (collapsible, live tag generation tracking)
   - Agent Assignment (game selector, source inputs, run button, activity log)
3. Firebase collections: `trivia-content`, `trivia-tags`, `trivia-agent-state`
4. Agent execution loop: Claude API calls with web search, pagination,
   dedup, tagging, citation gathering, resumability
5. Real-time UI updates as agent works

### What this produces

Up to 500 prioritized, tagged, cited subjects per trivia vertical.
6,000 total subjects across all 12 verticals. Each subject ready for
the downstream Question Designer Agent to research and generate
T/PT/F story-driven trivia questions.

### What this does NOT build

- The Question Designer Agent (Phase 2, separate spec)
- The Neon database or question schema
- The trivia game component itself
- The review/approval UI for questions
- The Firestore-to-game runtime sync

Those are downstream. This is the foundation — the content pipeline
that everything else builds upon.
