import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import {
  ALL_TRIVIA_GAMES,
  TRIVIA_GAME_DISPLAY_NAMES,
  compositeKey,
  listConfig,
} from "@/lib/trivia/constants";
import { normalizeSourceUrl, normalizeText } from "@/lib/trivia/sources";
import { assignTier } from "@/lib/trivia/tier";
import {
  type TriviaActivityEntry,
  type TriviaAgentStateDoc,
  type TriviaContentDoc,
  type TriviaGameId,
  type TriviaListType,
  type TriviaResearchBatchResult,
  type TriviaSourceItem,
  TRIVIA_TARGET_COUNT,
} from "@/lib/trivia/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 50;

// ─── POST handler ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await verifyIdToken(authHeader.substring(7));
    if (decoded["admin"] !== true) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  // Body
  let body: {
    gameId?: TriviaGameId;
    listType?: TriviaListType;
    sourceUrl?: string;
    pastedJson?: string;
    reset?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { gameId, listType, sourceUrl, pastedJson, reset } = body;
  if (!gameId || !ALL_TRIVIA_GAMES.includes(gameId)) {
    return NextResponse.json({ error: "Invalid or missing gameId" }, { status: 400 });
  }
  if (!listType || typeof listType !== "string") {
    return NextResponse.json({ error: "Missing listType" }, { status: 400 });
  }
  if (!listConfig(gameId, listType)) {
    return NextResponse.json(
      { error: `Unknown listType "${listType}" for ${gameId}` },
      { status: 400 },
    );
  }
  const hasUrl = sourceUrl && sourceUrl.trim().length > 0;
  const hasPaste = pastedJson && pastedJson.trim().length > 0;
  if (!hasUrl && !hasPaste) {
    return NextResponse.json(
      { error: "Provide either Source URL or pasted JSON" },
      { status: 400 },
    );
  }

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "Server missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const db = getAdminFirestore();
  const stateKey = compositeKey(gameId, listType);
  // Synthetic identifier for pasted JSON. Cache key is content-addressed by
  // hash so identical pastes hit the cache, different pastes invalidate it.
  const trimmedUrl = hasPaste
    ? `paste://${createHash("sha1").update(pastedJson!.trim()).digest("hex").slice(0, 16)}`
    : sourceUrl!.trim();
  const pastedText = hasPaste ? pastedJson!.trim() : null;

  try {
    const agentState = await loadOrCreateAgentState(db, gameId, listType, trimmedUrl, reset === true);

    if (agentState.status === "complete" && !reset) {
      return earlyReturn(gameId, listType, agentState, "complete", true, [
        {
          type: "complete",
          message: `${labelFor(gameId, listType)} already at ${agentState.totalFound}/${TRIVIA_TARGET_COUNT}. Reset to start over.`,
        },
      ]);
    }

    // Mark running
    await db
      .collection("trivia-agent-state")
      .doc(stateKey)
      .set(
        { status: "running" as const, lastRunAt: FieldValue.serverTimestamp(), error: null },
        { merge: true },
      );

    // ── Phase 1: cache (Claude normalizer runs ONCE per (game,list,url)) ──
    const log: TriviaActivityEntry[] = [];
    const cached = await loadOrPopulateCache(
      db,
      gameId,
      listType,
      trimmedUrl,
      pastedText,
      apiKey,
      log,
    );

    // ── Phase 2: pick the next slice of cached items, save them as-is ──
    const existingNames = await loadExistingNames(db, gameId, listType);
    const slice = pickNextSlice(cached, agentState.lastPageIndex, existingNames, BATCH_SIZE);

    if (slice.length === 0) {
      await db.collection("trivia-agent-state").doc(stateKey).set({ status: "complete" as const }, { merge: true });
      return NextResponse.json<TriviaResearchBatchResult>({
        gameId,
        listType,
        added: 0,
        skipped: 0,
        totalFound: agentState.totalFound,
        lastPageIndex: agentState.lastPageIndex,
        status: "complete",
        done: true,
        log: [
          ...log,
          {
            type: "complete",
            message:
              agentState.totalFound >= TRIVIA_TARGET_COUNT
                ? `Target reached: ${agentState.totalFound}/${TRIVIA_TARGET_COUNT}`
                : "Source list exhausted.",
          },
        ],
      });
    }

    let added = 0;
    let skipped = 0;
    let highestRank = agentState.lastPageIndex;

    for (const item of slice) {
      const tier = assignTier(item.rank);
      const citations: TriviaContentDoc["citations"] = [
        { name: "Source list", url: trimmedUrl, type: "primary" },
      ];
      if (item.citationUrl) {
        const refName = inferCitationName(item.citationUrl);
        citations.push({ name: refName, url: item.citationUrl, type: "primary" });
      }

      const doc: TriviaContentDoc & {
        createdAt: FirebaseFirestore.FieldValue;
        updatedAt: FirebaseFirestore.FieldValue;
      } = {
        gameId,
        listType,
        name: item.name,
        nameLower: item.name.toLowerCase().trim(),
        subtitle: item.creator ?? "",
        popularityRank: item.rank,
        tier,
        sourceDb: "json_normalizer_v1",
        sourceId: null,
        sourceUrl: trimmedUrl,
        citations,
        tags: {},
        crossTags: null,
        sourcePageIndex: item.rank,
        status: "indexed",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (typeof item.year === "number") doc.year = item.year;
      if (typeof item.provider === "string" && item.provider) doc.provider = item.provider;
      if (typeof item.genre === "string" && item.genre) doc.genre = item.genre;

      try {
        await db.collection("trivia-content").add(doc);
        added++;
        highestRank = Math.max(highestRank, item.rank);
        log.push({
          type: "found",
          rank: item.rank,
          message: `${item.name}${item.creator ? ` — ${item.creator}` : ""}`,
        });
      } catch (writeErr) {
        skipped++;
        log.push({
          type: "error",
          message: `Failed to save #${item.rank} ${item.name}: ${
            writeErr instanceof Error ? writeErr.message : "unknown"
          }`,
        });
      }
    }

    const newTotal = agentState.totalFound + added;
    const finished = newTotal >= TRIVIA_TARGET_COUNT || newTotal >= cached.length;
    const newStatus: TriviaAgentStateDoc["status"] = finished ? "complete" : "running";

    await db
      .collection("trivia-agent-state")
      .doc(stateKey)
      .set(
        {
          gameId,
          listType,
          sourceUrl: trimmedUrl,
          lastPageIndex: highestRank,
          totalFound: newTotal,
          status: newStatus,
          error: null,
          lastRunAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    log.push({
      type: finished ? "complete" : "info",
      message: finished
        ? `Complete: ${newTotal}/${cached.length} items saved.`
        : `Saved ${added} (skipped ${skipped}). Total ${labelFor(gameId, listType)}: ${newTotal}/${cached.length}.`,
    });

    console.log(
      `[trivia-research] uid=${uid} game=${gameId} list=${listType} added=${added} skipped=${skipped} total=${newTotal}`,
    );

    return NextResponse.json<TriviaResearchBatchResult>({
      gameId,
      listType,
      added,
      skipped,
      totalFound: newTotal,
      lastPageIndex: highestRank,
      status: newStatus,
      done: finished,
      log,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[trivia-research] Error:", err);
    try {
      await db
        .collection("trivia-agent-state")
        .doc(stateKey)
        .set({ status: "paused" as const, error: msg }, { merge: true });
    } catch {
      // best-effort
    }
    return NextResponse.json({ error: "Agent error", details: msg }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function labelFor(gameId: TriviaGameId, listType: TriviaListType): string {
  const cfg = listConfig(gameId, listType);
  return `${TRIVIA_GAME_DISPLAY_NAMES[gameId]} · ${cfg?.label ?? listType}`;
}

function earlyReturn(
  gameId: TriviaGameId,
  listType: TriviaListType,
  state: TriviaAgentStateDoc,
  status: TriviaAgentStateDoc["status"],
  done: boolean,
  log: TriviaActivityEntry[],
): NextResponse<TriviaResearchBatchResult> {
  return NextResponse.json<TriviaResearchBatchResult>({
    gameId,
    listType,
    added: 0,
    skipped: 0,
    totalFound: state.totalFound,
    lastPageIndex: state.lastPageIndex,
    status,
    done,
    log,
  });
}

async function loadOrCreateAgentState(
  db: Firestore,
  gameId: TriviaGameId,
  listType: TriviaListType,
  sourceUrl: string,
  reset: boolean,
): Promise<TriviaAgentStateDoc> {
  const ref = db.collection("trivia-agent-state").doc(compositeKey(gameId, listType));
  const snap = await ref.get();

  if (reset || !snap.exists) {
    const fresh: TriviaAgentStateDoc = {
      gameId,
      listType,
      sourceUrl,
      lastPageIndex: 0,
      totalFound: 0,
      status: "idle",
      error: null,
    };
    await ref.set(
      { ...fresh, createdAt: FieldValue.serverTimestamp(), lastRunAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    if (reset) {
      await wipeContent(db, gameId, listType);
      await db.collection("trivia-source-cache").doc(compositeKey(gameId, listType)).delete().catch(() => {});
    }
    return fresh;
  }

  const data = snap.data() as Partial<TriviaAgentStateDoc>;
  return {
    gameId,
    listType,
    sourceUrl: data.sourceUrl ?? sourceUrl,
    lastPageIndex: typeof data.lastPageIndex === "number" ? data.lastPageIndex : 0,
    totalFound: typeof data.totalFound === "number" ? data.totalFound : 0,
    status: data.status ?? "idle",
    error: data.error ?? null,
  };
}

async function wipeContent(db: Firestore, gameId: TriviaGameId, listType: TriviaListType): Promise<void> {
  const snap = await db
    .collection("trivia-content")
    .where("gameId", "==", gameId)
    .where("listType", "==", listType)
    .get();
  if (snap.empty) return;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }
}

async function loadOrPopulateCache(
  db: Firestore,
  gameId: TriviaGameId,
  listType: TriviaListType,
  sourceUrl: string,
  pastedText: string | null,
  anthropicApiKey: string,
  log: TriviaActivityEntry[],
): Promise<TriviaSourceItem[]> {
  const cacheRef = db.collection("trivia-source-cache").doc(compositeKey(gameId, listType));
  const cacheSnap = await cacheRef.get();

  if (cacheSnap.exists) {
    const data = cacheSnap.data();
    if (data && data["sourceUrl"] === sourceUrl && Array.isArray(data["items"]) && data["items"].length > 0) {
      log.push({
        type: "info",
        message: `Using cached source list (${data["items"].length} items).`,
      });
      return data["items"] as TriviaSourceItem[];
    }
  }

  log.push({
    type: "info",
    message: pastedText
      ? `Normalizing pasted JSON (${(pastedText.length / 1024).toFixed(1)} KB)…`
      : `Fetching + normalizing ${sourceUrl}…`,
  });
  const result = pastedText
    ? await normalizeText(pastedText, "application/json", sourceUrl, anthropicApiKey)
    : await normalizeSourceUrl(sourceUrl, anthropicApiKey);
  if (result.items.length === 0) {
    throw new Error(
      `Normalizer returned 0 items. Mapping was: ${JSON.stringify(result.mapping)}`,
    );
  }

  // Firestore single-doc limit is 1 MiB. We only ingest up to TRIVIA_TARGET_COUNT
  // items, so anything beyond that is wasted bytes — and large source files
  // (e.g. 16K+ video games) blow the limit. Cap to the target count.
  const cachedItems = result.items.slice(0, TRIVIA_TARGET_COUNT);
  const truncated = result.items.length > cachedItems.length;

  await cacheRef.set({
    gameId,
    listType,
    sourceUrl,
    loaderId: "json_normalizer_v1",
    mapping: result.mapping,
    items: cachedItems,
    fetchedAt: FieldValue.serverTimestamp(),
  });

  // Surface Claude's field mapping so the user can sanity-check on the fly.
  const m = result.mapping;
  const mappingStr = [
    `rank=${m.rankField ?? "(array order)"}`,
    `name=${m.nameField}`,
    m.creatorField ? `creator=${m.creatorField}` : null,
    m.yearField ? `year=${m.yearField}` : null,
    m.providerField ? `provider=${m.providerField}` : null,
    m.genreField ? `genre=${m.genreField}` : null,
    m.citationUrlField ? `citation=${m.citationUrlField}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  log.push({ type: "info", message: `Format: ${result.format}. Field mapping: ${mappingStr}` });
  log.push({
    type: "info",
    message: truncated
      ? `Source had ${result.arrayLength} items; capped cache at ${cachedItems.length} (target is ${TRIVIA_TARGET_COUNT}).`
      : `Discovered ${cachedItems.length} of ${result.arrayLength} items (rank ${cachedItems[0]?.rank} → ${cachedItems[cachedItems.length - 1]?.rank}).`,
  });
  return cachedItems;
}

async function loadExistingNames(
  db: Firestore,
  gameId: TriviaGameId,
  listType: TriviaListType,
): Promise<Set<string>> {
  const snap = await db
    .collection("trivia-content")
    .where("gameId", "==", gameId)
    .where("listType", "==", listType)
    .get();
  const names = new Set<string>();
  for (const d of snap.docs) {
    const nl = d.data()["nameLower"];
    if (typeof nl === "string") names.add(nl);
  }
  return names;
}

function inferCitationName(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("wikipedia")) return "Wikipedia";
    if (host.includes("goodreads")) return "Goodreads";
    if (host.includes("imdb")) return "IMDb";
    if (host.includes("rollingstone")) return "Rolling Stone";
    if (host.includes("allmusic")) return "AllMusic";
    if (host.includes("metacritic")) return "Metacritic";
    return host;
  } catch {
    return "Reference";
  }
}

function pickNextSlice(
  items: TriviaSourceItem[],
  lastPageIndex: number,
  existingNames: Set<string>,
  count: number,
): TriviaSourceItem[] {
  const out: TriviaSourceItem[] = [];
  for (const it of items) {
    if (out.length >= count) break;
    if (it.rank <= lastPageIndex) continue;
    if (existingNames.has(it.name.toLowerCase().trim())) continue;
    out.push(it);
  }
  return out;
}
