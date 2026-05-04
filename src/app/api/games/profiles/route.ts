import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";

interface PublicProfile {
  uid: string;
  gamertag: string;
  avatarName: string | null;
}

/**
 * Look up the public profile (gamertag + avatarName) for a list of UIDs.
 *
 * Why server-side: Firestore rules restrict /users/{uid} reads to the owner,
 * which is correct for the rest of the user doc. The invite picker still
 * needs to display gamertags + avatars for players the caller has met. We
 * use the Admin SDK to expose just those public fields, keeping the rest
 * of the user doc private.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  try {
    await verifyIdToken(authHeader.substring(7));
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  let uids: string[] = [];
  try {
    const body = await request.json();
    uids = (body as { uids?: unknown }).uids as string[];
    if (!Array.isArray(uids)) {
      return NextResponse.json({ error: "uids must be an array" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Filter to non-empty strings, drop AI placeholders, and cap at a sane limit.
  const cleanUids = Array.from(
    new Set(
      uids
        .filter((u): u is string => typeof u === "string" && u.length > 0)
        .filter((u) => !u.startsWith("ai-")),
    ),
  ).slice(0, 200);

  if (cleanUids.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  const db = getAdminFirestore();
  const refs = cleanUids.map((uid) => db.collection("users").doc(uid));
  const snaps = await db.getAll(...refs);

  const profiles: PublicProfile[] = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() ?? {};
    profiles.push({
      uid: snap.id,
      gamertag: (data["gamertag"] as string | undefined) ?? "Unknown",
      avatarName: (data["avatarName"] as string | undefined) ?? null,
    });
  }

  return NextResponse.json({ profiles });
}
