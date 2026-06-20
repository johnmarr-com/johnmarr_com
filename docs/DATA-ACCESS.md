# Data Access — the rule that keeps the app reliable on iOS

> **TL;DR — Read to render → HTTPS. Live push → poll-backed listener. Write → API
> route. Login → first-party auth domain. Never gate the app on a network read.**
>
> This is site-wide infrastructure guidance (auth, profile, friends, lobby, games),
> not just a games concern. New features must follow it. Related:
> [`GAME-SYNC-RESILIENCE-PLAN.md`](./GAME-SYNC-RESILIENCE-PLAN.md) (server-authority
> engine), [`GAMECORE-ARCHITECTURE.md`](./GAMECORE-ARCHITECTURE.md).

## Why this exists

iOS forces **every** browser (Safari, Chrome, Firefox, in-app WebViews) onto Apple's
**WebKit** engine — there is no real Chrome on iOS, and a native WebView is WebKit
too. WebKit aggressively suspends/kills long-lived connections (backgrounding, memory
pressure, tab inactivity) and reconnects poorly; its IndexedDB is historically flaky.

The Firebase **realtime SDK** does its reads over **one long-lived stream**
(WebChannel) plus an **IndexedDB** cache. On iOS that stream wedges, and a `getDoc`
or `onSnapshot` then **hangs 30s+**. Observed symptoms (all the same root):

- Home page stuck/slow "as if paused or blocked."
- One device frozen while another works fine (per-device, never the backend).
- Friends/games slow to load; **game owner can't start while joiners play** (the
  owner's device was the wedged one).

Desktop never fails because real Chrome (Blink) keeps the stream alive forever.
**It is always the device, never Firestore-the-database.** The weak point is the
realtime SDK's persistent-connection model on WebKit — and you **cannot** dodge it by
switching browsers or wrapping in a WebView (all WebKit). The only fix is to stop
depending on that stream for anything that must not hang.

## The rule

| Need | Use | Why |
|---|---|---|
| **Read to render** (profile, friends, sessions, content, lobby) | **Plain HTTPS** — a Next API route using the Admin SDK | A stateless request opens its own connection per call; immune to the stream-wedge; identical on every device. |
| **Live push** (other users' changes without a refresh: active gameplay, incoming invites) | `onSnapshot` listener **+ HTTPS poll fallback** | Only this genuinely needs a stream; the poll self-heals a wedge. See `subscribeToSession`. |
| **Write** (game/shared state) | **API route** (Admin SDK, server-validated) | Reliable + authoritative. (Client-direct SDK writes queue locally and flush on reconnect — durable but can be delayed; prefer routes where timing matters.) |
| **Login** | **First-party auth domain** | `signInWithRedirect` breaks under iOS ITP when `authDomain` is the default `*.firebaseapp.com` (cross-site). Serve auth from our own domain (proxy `/__/auth/*`, set `authDomain` to the app domain). |
| **Instant render** | **localStorage cache** + background HTTPS refresh | UI never blocks on a network read. Hydrate synchronously, then refresh. Never cache transient flags (e.g. `levelledUp`). |
| **App load gating** | Gate only on **auth state** (local, fast), never on data reads | `onAuthStateChanged` resolves logged-in/out from local persistence with no network. Enrich profile/data in the background. |

## Building blocks already in place (use these as templates)

- **`subscribeToSession`** (`src/lib/game-sessions.ts`) — the reference resilient
  read: push (`onSnapshot`) + monotonic-`seq` stale-gate (drop out-of-order
  snapshots) + **HTTPS poll fallback** (`/api/games/session-state`) + connection-kick.
- **`kickFirestoreConnection`** (`src/lib/firebase.ts`) — `disableNetwork →
  enableNetwork` to rebuild a wedged stream; fired on `visibilitychange` / `online`.
- **`useEngineDeadline`** + **`/api/games/engine-tick`** — client nudge so
  server-authority phase deadlines fire without depending on the stream.
- **`/api/me`** + the localStorage profile cache in `AuthProvider` — the template
  for converting other load-time reads (friends, sessions) to HTTPS.
- **Server-authority engine** (`functions/src/engine`) — Firestore-triggered reducers
  own all game progression; clients submit intents via API routes and render state.
  (See [`GAME-SYNC-RESILIENCE-PLAN.md`](./GAME-SYNC-RESILIENCE-PLAN.md).)

## Checklist when adding a feature

1. **Reading to paint a screen?** → HTTPS API route. *Not* a client `getDoc`/`getDocs`.
2. **Need other users' live changes?** → listener, **plus** a poll fallback.
3. **Writing game/shared state?** → API route.
4. **Does the screen block on any read?** → cache + background refresh instead.
5. **Touching auth/login?** → keep auth state resolution local; don't add a network
   read to the load gate; respect the first-party auth-domain requirement.
