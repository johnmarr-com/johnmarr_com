"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { getOfficialHeists, getMyHeists, getSharedHeists } from "@/lib/fyve-heists";
import { JMAssetPicker, type JMAssetPickerItem } from "@/JMKit";
import { useGameColors, toPickerColors } from "@/app/games/_gamecore";
import type { FyveHeist } from "./fyveTypes";

type HeistItem = FyveHeist & JMAssetPickerItem;

function toItem(h: FyveHeist): HeistItem {
  // JMAssetPicker shows `name` (FyveHeist uses `title`) + subtitle + cover.
  return {
    ...h,
    name: h.title,
    subtitle: h.setting?.location ?? "",
    ...(h.backgroundImageUrl ? { coverImageURL: h.backgroundImageUrl } : {}),
  } as HeistItem;
}

interface FyveHeistPickerProps {
  /** Fired with the chosen heist when the host taps Play. */
  onSelect: (heist: FyveHeist) => void;
  /** Omit to hide the close button (host must pick to start). */
  onClose?: (() => void) | undefined;
}

/**
 * Host heist picker — same shared modal as the other games (JMAssetPicker):
 * a default heist is pre-selected so the host can tap Play immediately, or
 * switch heists first. No detail drill-in (the briefing phase shows details).
 */
export default function FyveHeistPicker({ onSelect, onClose }: FyveHeistPickerProps) {
  const { user } = useAuth();
  const gc = useGameColors();
  const [official, setOfficial] = useState<HeistItem[]>([]);
  const [shared, setShared] = useState<HeistItem[]>([]);
  const [mine, setMine] = useState<HeistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [off, sh, my] = await Promise.all([
          getOfficialHeists(),
          getSharedHeists(),
          user ? getMyHeists(user.uid) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setOfficial(off.map(toItem));
        setShared(sh.map(toItem));
        setMine(my.map(toItem));
      } catch (e) {
        console.error("[FyveHeistPicker]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const tabs = useMemo(
    () => [
      { key: "official", label: "Official", items: official },
      { key: "mine", label: "My Heists", items: mine, emptyMessage: "You haven’t created any heists yet." },
      { key: "shared", label: "Shared", items: shared },
    ],
    [official, mine, shared],
  );

  // FYVE modal: navy fill + orange accents (CMS-overridable; brand palette
  // isn't set yet, so fall back to FYVE's fixed colors rather than gc.*).
  const modalColors = toPickerColors({
    background: gc.modalBg || "#0D1B2E",
    accent: gc.modalAccent || "#E84C1E",
    tab: gc.modalTab || "#E84C1E",
    border: gc.modalBorder || "#E84C1E",
  });

  return (
    <JMAssetPicker<HeistItem>
      title="Choose a Heist"
      tabs={tabs}
      onSelect={onSelect}
      onClose={onClose}
      loading={loading}
      actionLabel="Play"
      colors={modalColors}
    />
  );
}
