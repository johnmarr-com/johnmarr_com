import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

const GAMERTAG_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export async function POST(request: NextRequest) {
  try {
    const { gamertag } = (await request.json()) as { gamertag: string };

    if (!gamertag || typeof gamertag !== "string") {
      return NextResponse.json({ error: "gamertag is required" }, { status: 400 });
    }

    if (!GAMERTAG_REGEX.test(gamertag)) {
      return NextResponse.json({
        available: false,
        reason: "Must be 3–20 characters: letters, numbers, underscores, or hyphens.",
      });
    }

    const db = getAdminFirestore();
    const doc = await db.collection("gamertags").doc(gamertag.toLowerCase()).get();

    return NextResponse.json({ available: !doc.exists });
  } catch (error) {
    console.error("Error checking gamertag:", error);
    return NextResponse.json({ error: "Failed to check gamertag" }, { status: 500 });
  }
}
