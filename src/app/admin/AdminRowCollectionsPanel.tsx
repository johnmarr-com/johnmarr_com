"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import type { JMRowCollection } from "@/lib/content-types";
import {
  createRowCollection,
  deleteRowCollection,
  listRowCollections,
  renameRowCollection,
} from "@/lib/row-collections";
import { AdminHomeRowsPanel } from "./AdminHomeRowsPanel";

export function AdminRowCollectionsPanel() {
  const { theme } = useJMStyle();
  const { user } = useAuth();

  const [collections, setCollections] = useState<JMRowCollection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setCollections(await listRowCollections());
    } catch (err) {
      console.error("Failed to load row collections:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleNew = async () => {
    if (!user) return;
    const name = window.prompt("New row collection name:");
    if (!name?.trim()) return;
    const c = await createRowCollection({ name: name.trim() }, user.uid);
    await load();
    setCollectionId(c.id);
  };

  const handleRename = async () => {
    const c = collections.find((x) => x.id === collectionId);
    if (!c) return;
    const name = window.prompt("Rename row collection:", c.name);
    if (!name?.trim()) return;
    await renameRowCollection(c.id, name.trim());
    await load();
  };

  const handleDelete = async () => {
    const c = collections.find((x) => x.id === collectionId);
    if (!c) return;
    if (
      !window.confirm(
        `Delete row collection "${c.name}"? Its rows keep their data but become unassigned.`,
      )
    ) {
      return;
    }
    await deleteRowCollection(c.id);
    await load();
    setCollectionId("");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Layers size={24} style={{ color: theme.accents.goldenGlow }} />
        <div>
          <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
            Row Collections
          </h2>
          <p className="text-sm" style={{ color: theme.text.tertiary }}>
            {isLoading
              ? "Loading…"
              : `${collections.length} collection${collections.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Collection selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm" style={{ color: theme.text.secondary }}>
          Collection:
        </span>
        <select
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
          className="rounded-lg border-2 px-3 py-2 text-sm"
          style={{
            borderColor: theme.surfaces.elevated2,
            backgroundColor: theme.surfaces.elevated1,
            color: theme.text.primary,
          }}
        >
          <option value="">— Select a collection —</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm"
          style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
        >
          <Plus size={14} /> New
        </button>
        {collectionId && (
          <>
            <button
              onClick={handleRename}
              className="flex items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
            >
              <Pencil size={14} /> Rename
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.semantic.error }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </>
        )}
      </div>

      {/* Rows for the selected collection */}
      {collectionId ? (
        <AdminHomeRowsPanel rowCollectionId={collectionId} />
      ) : (
        <p
          className="rounded-xl border-2 border-dashed px-4 py-10 text-center text-sm"
          style={{ borderColor: theme.surfaces.elevated2, color: theme.text.tertiary }}
        >
          Select a collection (or create one) to manage its rows.
        </p>
      )}
    </div>
  );
}
