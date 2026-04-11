"use client";

import type { Timestamp } from "firebase/firestore";

// ─── Types ───────────────────────────────────────────────────

export interface MissionSegment {
  descriptiveText: string;
  missionText: string;
}

export interface MegaSketchyMission {
  id: string;
  title: string;
  creatorId: string;
  creatorGamertag: string;
  segments: MissionSegment[];
  maxPlayers: number;
  visibility: "official" | "private" | "shared";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateMissionInput {
  title: string;
  segments: MissionSegment[];
  visibility: "official" | "private" | "shared";
}

// ─── Firestore Helpers ───────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

// ─── CRUD ────────────────────────────────────────────────────

export async function createMission(
  input: CreateMissionInput,
  userId: string,
  gamertag: string,
): Promise<MegaSketchyMission> {
  const { collection, doc, setDoc, serverTimestamp } =
    await import("firebase/firestore");
  const db = await getDb();

  const ref = doc(collection(db, "megasketchyMissions"));
  const data = {
    title: input.title,
    creatorId: userId,
    creatorGamertag: gamertag,
    segments: input.segments,
    maxPlayers: input.segments.length,
    visibility: input.visibility,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);

  return {
    id: ref.id,
    ...data,
    createdAt: data.createdAt as unknown as Timestamp,
    updatedAt: data.updatedAt as unknown as Timestamp,
  };
}

export async function getMission(
  missionId: string,
): Promise<MegaSketchyMission | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDoc(doc(db, "megasketchyMissions", missionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<MegaSketchyMission, "id">) };
}

export async function getOfficialMissions(): Promise<MegaSketchyMission[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "megasketchyMissions"),
    where("visibility", "==", "official"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MegaSketchyMission, "id">) }));
}

export async function getMyMissions(
  userId: string,
): Promise<MegaSketchyMission[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "megasketchyMissions"),
    where("creatorId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MegaSketchyMission, "id">) }));
}

export async function getSharedMissions(): Promise<MegaSketchyMission[]> {
  const { collection, query, where, orderBy, getDocs } =
    await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "megasketchyMissions"),
    where("visibility", "==", "shared"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MegaSketchyMission, "id">) }));
}

export async function updateMission(
  missionId: string,
  updates: Partial<Pick<MegaSketchyMission, "title" | "segments" | "visibility">>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const data: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  if (updates.segments) {
    data["maxPlayers"] = updates.segments.length;
  }

  await updateDoc(doc(db, "megasketchyMissions", missionId), data);
}

export async function deleteMission(missionId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();
  await deleteDoc(doc(db, "megasketchyMissions", missionId));
}

export async function copyMission(
  missionId: string,
  userId: string,
  gamertag: string,
): Promise<MegaSketchyMission> {
  const source = await getMission(missionId);
  if (!source) throw new Error("Mission not found");

  return createMission(
    {
      title: `${source.title} (Copy)`,
      segments: source.segments,
      visibility: "private",
    },
    userId,
    gamertag,
  );
}

/**
 * Convert a MegaSketchyMission into the template/elements format the game engine expects.
 * Truncates to `playerCount` segments if the mission has more.
 */
export function missionToSecretMessage(
  mission: MegaSketchyMission,
  playerCount: number,
): { template: string; elements: string[]; sourceId: string } {
  const count = Math.min(playerCount, mission.segments.length);
  const segments = mission.segments.slice(0, count);

  const templateParts: string[] = [];
  const elements: string[] = [];

  segments.forEach((seg, i) => {
    const desc = seg.descriptiveText.trim();
    if (desc) {
      templateParts.push(`${desc} "{${i}}"`);
    } else {
      templateParts.push(`"{${i}}"`);
    }
    elements.push(seg.missionText);
  });

  let template = templateParts.join(" ");
  if (!/[.!?]$/.test(template)) template += ".";

  return { template, elements, sourceId: mission.id };
}
