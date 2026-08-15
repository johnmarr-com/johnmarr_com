"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Layers } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { getTopLevelContent } from "@/lib/content";

/**
 * AdminPacksPanel — Inventing Studio home for pack building.
 *
 * Lists every game engine with customizable content / deck building and
 * jumps straight to its pack creator (the same screen reached from the
 * game landing page's top-right builder button) without a detour through
 * the game itself.
 */

/** Engines with a pack builder at /games/{engine}/packs. */
const DECK_ENGINES: { engine: string; fallbackName: string }[] = [
  { engine: "azv", fallbackName: "Atomic Zombie Vampires" },
  { engine: "blarf", fallbackName: "Blarf" },
  { engine: "bluffbox", fallbackName: "Bluff Box" },
  { engine: "bullshiitake", fallbackName: "Bull Shiitake" },
  { engine: "wordonkulous", fallbackName: "Wordonkulous" },
];

interface DeckGameTile {
  engine: string;
  name: string;
  coverURL: string;
}

export function AdminPacksPanel() {
  const { theme } = useJMStyle();
  const router = useRouter();
  const [tiles, setTiles] = useState<DeckGameTile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Match CMS game content to deck engines for names + icons. A game
        // plays on its engineSlug when set (composite games), else its slug.
        const games = await getTopLevelContent("game", false);
        const byEngine = new Map<string, { name: string; coverURL: string }>();
        for (const g of games) {
          const engine = (g.engineSlug ?? g.slug ?? "").trim();
          if (engine && !byEngine.has(engine)) {
            byEngine.set(engine, { name: g.name, coverURL: g.coverURL });
          }
        }
        if (cancelled) return;
        setTiles(
          DECK_ENGINES.map(({ engine, fallbackName }) => ({
            engine,
            name: byEngine.get(engine)?.name ?? fallbackName,
            coverURL: byEngine.get(engine)?.coverURL ?? "",
          })),
        );
      } catch (err) {
        console.error("[packs] failed to load games:", err);
        if (!cancelled) {
          setTiles(
            DECK_ENGINES.map(({ engine, fallbackName }) => ({
              engine,
              name: fallbackName,
              coverURL: "",
            })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: theme.text.primary }}>
          Packs
        </h2>
        <p className="mt-1 text-sm" style={{ color: theme.text.secondary }}>
          Pick a game to open its pack creator / editor.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.text.secondary }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <button
              key={tile.engine}
              type="button"
              onClick={() => router.push(`/games/${tile.engine}/packs`)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:scale-[1.03] hover:border-white/25 hover:bg-white/10 active:scale-95"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-neutral-800">
                {tile.coverURL ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- Storage URL */
                  <img
                    src={tile.coverURL}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Layers className="h-10 w-10 text-white/15" />
                  </div>
                )}
              </div>
              <span className="text-sm font-bold" style={{ color: theme.text.primary }}>
                {tile.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
