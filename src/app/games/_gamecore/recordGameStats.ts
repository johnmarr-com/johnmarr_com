/**
 * Record game completion stats for all players.
 * Increments gamesPlayed for everyone, gamesHosted for the host,
 * gamesWon for winners, and gamesLost for non-winners.
 */
export async function recordGameStats(
  playerUids: string[],
  winnerUids: string[],
  hostUid: string,
): Promise<void> {
  const { initializeFirebase } = await import("@/lib/firebase");
  const { getFirestore, doc, updateDoc, increment } = await import(
    "firebase/firestore"
  );
  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const winnerSet = new Set(winnerUids);

  const writes = playerUids
    .filter((uid) => !uid.startsWith("ai-"))
    .map((uid) => {
      const isWinner = winnerSet.has(uid);
      const isHost = uid === hostUid;

      const fields: Record<string, ReturnType<typeof increment>> = {
        gamesPlayed: increment(1),
      };
      if (isHost) fields["gamesHosted"] = increment(1);
      if (isWinner) fields["gamesWon"] = increment(1);
      if (!isWinner) fields["gamesLost"] = increment(1);

      return updateDoc(doc(db, "users", uid), fields);
    });

  await Promise.allSettled(writes);
}
