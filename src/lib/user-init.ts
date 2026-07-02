/**
 * Shared initial user-document fields.
 *
 * Used by BOTH the client (`saveUserProfile` in `auth.ts`) and the server
 * (`/api/me`, which creates the doc on first sign-in) so the two can't drift.
 *
 * Timestamps are intentionally omitted: `createdAt`/`updatedAt` use a
 * `serverTimestamp()` sentinel that differs between the client SDK and the
 * Admin SDK, so each caller adds them. `gamertag`/`gamertagLower` are also
 * omitted — the gamertag is claimed via `/api/user/gamertag`, and writing a
 * null here (on a later-flushing client write) could clobber it. Absent fields
 * read as their defaults everywhere (`?? null`, `?? 1`, `?? 0`).
 */

export interface UserIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function buildInitialUserFields(identity: UserIdentity): Record<string, unknown> {
  return {
    uid: identity.uid,
    email: identity.email,
    displayName: identity.displayName,
    photoURL: identity.photoURL,
    avatarName: null, // Lottie avatar filename
    level: 1,
    // Subscription
    tier: "free",
    monthsPaid: 0,
    // Gift access
    giftMonthsStarted: null,
    giftMonthsRemaining: 0,
    lifetimeGift: false,
    // Points & leveling
    points: 0,
    levelledUp: false,
    // Activity tracking
    showsWatched: 0,
    storiesRead: 0,
    gamesPlayed: 0,
    gamesHosted: 0,
    gamesWon: 0,
    gamesLost: 0,
    cardsViewed: 0,
    cardsSent: 0,
    shares: 0,
    favorites: [],
  };
}
