"use client";

/**
 * AI Personas CRUD Operations
 *
 * Firestore Collection: /aiPersonas/{personaId}
 */

import type { Timestamp } from "firebase/firestore";
import type { AIPlayStyle, AISkillLevel } from "@/app/games/_gamecore/aiPersonas";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface AIPersonaStats {
  wins: number;
  losses: number;
  gamesPlayed: number;
  tournamentBestRound: number;
}

export interface AIPersonaDoc {
  id: string;
  name: string;
  avatarName: string;
  playStyle: AIPlayStyle;
  /** Difficulty tier. Optional on older docs — readers should default to "pro". */
  skillLevel?: AISkillLevel;
  description: string;
  prompt: string;
  voice: string;
  avatarScale: number;
  stats: AIPersonaStats;
  order: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AIPersonaInput {
  name: string;
  avatarName: string;
  playStyle: AIPlayStyle;
  skillLevel?: AISkillLevel;
  description: string;
  prompt: string;
  voice: string;
  avatarScale?: number;
  order?: number;
  isActive?: boolean;
}

export type AIPersonaUpdate = Partial<Omit<AIPersonaInput, "order">> & {
  order?: number;
  isActive?: boolean;
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function getDb() {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  return getFirestore(app);
}

// ─────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────

export async function getAllAIPersonas(): Promise<AIPersonaDoc[]> {
  const { collection, query, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();

  const q = query(collection(db, "aiPersonas"), orderBy("order", "asc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AIPersonaDoc, "id">) }));
}

export async function getActiveAIPersonas(): Promise<AIPersonaDoc[]> {
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");
  const db = await getDb();

  const q = query(
    collection(db, "aiPersonas"),
    where("isActive", "==", true),
    orderBy("order", "asc"),
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AIPersonaDoc, "id">) }));
}

export async function getAIPersona(personaId: string): Promise<AIPersonaDoc | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const db = await getDb();

  const snap = await getDoc(doc(db, "aiPersonas", personaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<AIPersonaDoc, "id">) };
}

export async function createAIPersona(input: AIPersonaInput): Promise<AIPersonaDoc> {
  const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  const data = {
    name: input.name,
    avatarName: input.avatarName,
    playStyle: input.playStyle,
    skillLevel: input.skillLevel ?? 7, // Champion default
    description: input.description,
    prompt: input.prompt,
    voice: input.voice,
    avatarScale: input.avatarScale ?? 1.0,
    stats: { wins: 0, losses: 0, gamesPlayed: 0, tournamentBestRound: 0 },
    order: input.order ?? 0,
    isActive: input.isActive ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "aiPersonas"), data);

  return { id: ref.id, ...data } as unknown as AIPersonaDoc;
}

export async function updateAIPersona(
  personaId: string,
  updates: AIPersonaUpdate,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = await getDb();

  await updateDoc(doc(db, "aiPersonas", personaId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAIPersona(personaId: string): Promise<void> {
  const { doc, deleteDoc } = await import("firebase/firestore");
  const db = await getDb();

  await deleteDoc(doc(db, "aiPersonas", personaId));
}

// ─────────────────────────────────────────────────────────────
// STAT TRACKING (via callable Cloud Function)
// ─────────────────────────────────────────────────────────────

export async function recordAIGameResult(
  personaId: string,
  won: boolean,
): Promise<void> {
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const { initializeFirebase } = await import("./firebase");
  const { app } = await initializeFirebase();
  const functions = getFunctions(app);
  const fn = httpsCallable(functions, "recordAIGameResult");
  await fn({ personaId, won });
}
