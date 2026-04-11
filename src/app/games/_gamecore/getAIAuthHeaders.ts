/**
 * Lazily fetches the current Firebase user's ID token and returns
 * headers suitable for authenticated fetch calls to /api/games/ai.
 */
export async function getAIAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { getAuth } = await import("@/lib/auth");
    const auth = await getAuth();
    const user = auth.currentUser;
    if (!user) return { "Content-Type": "application/json" };

    const idToken = await user.getIdToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    };
  } catch {
    return { "Content-Type": "application/json" };
  }
}
