import type { TriviaGameId, TriviaListType } from "./types";

export const ALL_TRIVIA_GAMES: TriviaGameId[] = [
  "nabster",
  "outtakes",
  "plated",
  "extra_extra",
  "pwn_stars",
  "first_ed",
  "geek_freak",
  "ctrl_alt_defeat",
  "paparazza",
  "pop_wow",
  "season_tix",
  "where_in_the",
];

export const TRIVIA_GAME_DISPLAY_NAMES: Record<TriviaGameId, string> = {
  nabster: "Nabster",
  outtakes: "OutTakes",
  plated: "Plated",
  extra_extra: "Extra Extra",
  pwn_stars: "Pwn Stars",
  first_ed: "1st Ed.",
  geek_freak: "Geek Freak",
  ctrl_alt_defeat: "Ctrl Alt Defeat",
  paparazza: "Paparazza",
  pop_wow: "Pop Wow",
  season_tix: "Season Tix",
  where_in_the: "Where In The",
};

/**
 * Domain text injected into the agent system prompt so Claude knows
 * what kind of subjects to find for the selected vertical.
 */
export const TRIVIA_GAME_DOMAINS: Record<TriviaGameId, string> = {
  nabster:
    "Music (albums, artists, songs, music history)",
  outtakes:
    "Movies (films, directors, actors, production, box office)",
  plated:
    "Food & Culinary (dishes, cuisines, chefs, restaurants, culinary history)",
  extra_extra:
    "History & World Events (historical events, figures, movements, eras)",
  pwn_stars:
    "Video Games (games, consoles, developers, gaming culture, esports)",
  first_ed:
    "Literature (novels, authors, poetry, literary movements, publishing)",
  geek_freak:
    "Science & Space (discoveries, inventions, space missions, scientists)",
  ctrl_alt_defeat:
    "Computer & Tech History (hardware, software, internet, tech companies)",
  paparazza:
    "Celebrity Gossip (celebrity lives, feuds, scandals, relationships)",
  pop_wow:
    "Pop Culture (memes, viral moments, trends, cultural phenomena)",
  season_tix:
    "Sports (athletes, games, records, championships, sports history)",
  where_in_the:
    "Geography (countries, landmarks, borders, records, cultural geography)",
};

/**
 * Free-search hint per vertical. Injected into the agent prompt to
 * steer Claude toward consensus "best of" / "most popular" lists when
 * no Source URL is supplied.
 */
export const TRIVIA_FREE_SEARCH_HINTS: Record<TriviaGameId, string> = {
  nabster:
    'Look for consensus "greatest albums of all time" lists (Rolling Stone, NME, Pitchfork), Billboard 200 all-time, Wikipedia best-selling album lists.',
  outtakes:
    'Look for consensus "greatest films of all time" lists (AFI, BFI Sight & Sound, IMDb Top 250), highest-grossing film lists, Wikipedia notable film lists.',
  plated:
    'Look for "most famous dishes in the world", iconic cuisine lists, Wikipedia national dish lists, James Beard / Michelin recognized dishes.',
  extra_extra:
    'Look for "most important historical events" lists, turning points in history, Wikipedia history portals, century-defining moments.',
  pwn_stars:
    'Look for "greatest video games of all time" lists (IGN, Polygon, Edge), best-selling video games, Wikipedia notable game lists.',
  first_ed:
    'Look for "greatest novels of all time" lists (Modern Library 100, Time 100, NYT 100), most-translated books, Wikipedia bestseller lists.',
  geek_freak:
    'Look for "greatest scientific discoveries" lists, most important inventions, Nobel laureates, NASA missions, Wikipedia science timelines.',
  ctrl_alt_defeat:
    'Look for "history of computing milestones", most important tech products, Computer History Museum exhibits, Wikipedia computing timelines.',
  paparazza:
    'Look for most famous celebrities by influence, biggest celebrity scandals, Forbes most powerful celebrities, iconic pop culture moments.',
  pop_wow:
    'Look for "defining pop culture moments by decade", most viral cultural events, Time 100, Know Your Meme staff picks.',
  season_tix:
    'Look for "greatest sports moments", most famous athletes (ESPN, Sports Illustrated), iconic championships, Wikipedia sports halls of fame.',
  where_in_the:
    'Look for most famous landmarks, UNESCO World Heritage sites, surprising geography facts, world records by country.',
};

/**
 * Optional starter URLs per vertical. Pre-fills the Source URL field
 * when the user picks a game. Blanks fall back to free search.
 *
 * Curated lists are higher quality than free search because the
 * popularity ranking is human-edited.
 */
/**
 * Per-game ranked-list registry. Each entry produces one (gameId, listType)
 * stream the agent can populate. Adding new lists later is just adding
 * new entries here.
 */
export interface TriviaListConfig {
  id: TriviaListType;
  label: string;
  defaultUrl: string;
}

export const TRIVIA_GAME_LISTS: Record<TriviaGameId, TriviaListConfig[]> = {
  nabster: [
    {
      id: "albums",
      label: "Top 500 Albums",
      defaultUrl:
        "https://gist.githubusercontent.com/nanotaboada/e8b83ed5ff4bb35a227b9b5c9173b72b/raw",
    },
    {
      id: "songs",
      label: "Top 500 Songs",
      defaultUrl:
        "https://gist.githubusercontent.com/keune/0de5c7fb669f7b682874/raw",
    },
  ],
  outtakes: [
    {
      id: "films",
      label: "Top 500 Films",
      defaultUrl:
        "https://gist.githubusercontent.com/vimagick/fbc551ecece8639dc0bea18ac7113450/raw/imdb-top-1000.tsv",
    },
  ],
  plated: [
    {
      id: "dishes",
      label: "Top 500 Dishes",
      // Hand-curated list of 308 globally-famous dishes (Claude Max output, encoding-cleaned).
      // File at public/data/dishes-top500.json.
      defaultUrl: "http://localhost:3000/data/dishes-top500.json",
    },
  ],
  extra_extra: [
    { id: "events", label: "Top 500 Historical Events", defaultUrl: "" },
  ],
  pwn_stars: [
    {
      id: "games",
      label: "Top 500 Video Games",
      defaultUrl:
        "https://raw.githubusercontent.com/Bakikhan/Video-Game-Sales-Dataset/main/Video_Games.csv",
    },
  ],
  first_ed: [
    {
      id: "books",
      label: "Top 500 Books",
      defaultUrl: "https://en.wikipedia.org/wiki/List_of_best-selling_books",
    },
  ],
  geek_freak: [
    { id: "discoveries", label: "Top 500 Scientific Discoveries", defaultUrl: "" },
  ],
  ctrl_alt_defeat: [
    { id: "milestones", label: "Top 500 Tech Milestones", defaultUrl: "" },
  ],
  paparazza: [
    {
      id: "celebrities",
      label: "Top 500 Celebrities",
      // Modern entertainment celebs from Pantheon 2.0 (filtered + ranked by HPI).
      // File generated by `node scripts/prep-pantheon.mjs` and committed under public/data.
      defaultUrl: "http://localhost:3000/data/pantheon-celebrities-top500.csv",
    },
  ],
  pop_wow: [
    { id: "moments", label: "Top 500 Pop Culture Moments", defaultUrl: "" },
  ],
  season_tix: [
    {
      id: "athletes",
      label: "Top 500 Athletes",
      // Athletes from Pantheon 2.0, ranked by HPI.
      // File generated by `node scripts/prep-pantheon.mjs` and committed under public/data.
      defaultUrl: "http://localhost:3000/data/pantheon-athletes-top500.csv",
    },
  ],
  where_in_the: [
    { id: "places", label: "Top 500 Places", defaultUrl: "" },
  ],
};

export function getDefaultUrl(
  gameId: TriviaGameId,
  listType: TriviaListType,
): string {
  return (
    TRIVIA_GAME_LISTS[gameId]?.find((l) => l.id === listType)?.defaultUrl ?? ""
  );
}

export function listConfig(
  gameId: TriviaGameId,
  listType: TriviaListType,
): TriviaListConfig | null {
  return TRIVIA_GAME_LISTS[gameId]?.find((l) => l.id === listType) ?? null;
}

export function listLabel(
  gameId: TriviaGameId,
  listType: TriviaListType,
): string {
  return listConfig(gameId, listType)?.label ?? listType;
}

/** Composite Firestore doc id for cache + agent-state keyed on (gameId, listType). */
export function compositeKey(
  gameId: TriviaGameId,
  listType: TriviaListType,
): string {
  return `${gameId}__${listType}`;
}

/**
 * Brand color per vertical for the dashboard cells.
 */
export const TRIVIA_GAME_COLORS: Record<TriviaGameId, string> = {
  nabster: "#FF3B6F",
  outtakes: "#4DA3FF",
  plated: "#F39C12",
  extra_extra: "#A78BFA",
  pwn_stars: "#22D3EE",
  first_ed: "#84CC16",
  geek_freak: "#10B981",
  ctrl_alt_defeat: "#06B6D4",
  paparazza: "#F472B6",
  pop_wow: "#FB923C",
  season_tix: "#EAB308",
  where_in_the: "#60A5FA",
};
