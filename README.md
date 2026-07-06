# johnmarr.com

A mobile-first social entertainment platform under the "J" umbrella brand:
CMS-composed pages routing into shows (short-form video), music, EPUB
stories, ScrollyFox scroll-experiences, and real-time multiplayer games —
tied together by one identity (Firebase Auth + gamertag + avatar) and one
gamification spine (points → 10 levels).

**Strategy:** shows and content are shared on social channels to drive
traffic to the free site; the site trades fun for emails; the email list
later powers marketing for a Kickstarter and/or a paid Pro tier.

## Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind v4, deployed on
  Firebase App Hosting (Cloud Run).
- **Backend:** Firebase — Auth, Firestore, Storage, Cloud Functions
  (`functions/` — the server-authority game engine + cleanup). Neon Postgres
  for trivia/funnel analytics.
- **AI:** Anthropic Claude (game AI, LLM judging), Ideogram/Replicate
  (image gen).

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # type-check + lint (warnings are errors; pre-commit enforced)
```

## Where things live

| Area | Path |
|---|---|
| Experience surfaces | `src/app/` (`_home`, `show`, `artist`, `story`, `scrollyfox`, `games`, `[...slug]` CMS pages) |
| Game factory (client) | `src/app/games/_gamecore/` |
| Server-authority game engine | `functions/src/engine/` + `functions/src/games/` |
| Shared UI kit / theme | `src/JMKit/`, `src/JMStyle/` |
| Data + content model | `src/lib/` (`content-types.ts`, `content-server.ts`, `game-sessions.ts`, `AuthProvider.tsx`) |
| Admin CMS ("Inventing.Studio") | `src/app/admin/` |

## Documentation

**[`docs/README.md`](./docs/README.md)** is the index. Start with:

- [`docs/GAME-DEVELOPMENT-GUIDE.md`](./docs/GAME-DEVELOPMENT-GUIDE.md) — build/maintain games
- [`docs/SERVER-AUTHORITY-ENGINE.md`](./docs/SERVER-AUTHORITY-ENGINE.md) — how multiplayer state works
- [`docs/DATA-ACCESS.md`](./docs/DATA-ACCESS.md) — the site-wide data-access rule (read before adding any feature)
- [`docs/SYSTEM-REVIEW.md`](./docs/SYSTEM-REVIEW.md) — prioritized backlog of known gaps
