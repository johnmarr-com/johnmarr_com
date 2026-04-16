"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/AuthProvider";
import { getOfficialHeists, getMyHeists, getSharedHeists } from "@/lib/sevyn-heists";
import {
  JMSelectAsset,
  JM_SELECT_ASSET_DETAIL_Z,
  type JMSelectAssetTab,
} from "@/JMKit/JMSelectAsset";
import { JMCloseCircleButton } from "@/JMKit/JMCloseCircleButton";
import { GamePrimaryButton } from "@/app/games/_gamecore";
import type { SevynHeist } from "./sevynTypes";

type SubTab = "official" | "my" | "shared";

const SUB_TABS: JMSelectAssetTab[] = [
  { id: "official", label: "Official" },
  { id: "my", label: "My Heists" },
  { id: "shared", label: "Shared" },
];

interface HeistPickerModalProps {
  onSelect: (heist: SevynHeist) => void;
  onClose: () => void;
  /** Primary accent color from game CMS definition */
  accentColor?: string;
}

export default function HeistPickerModal({
  onSelect,
  onClose,
  accentColor = "#E84C1E",
}: HeistPickerModalProps) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("official");
  const [officialList, setOfficialList] = useState<SevynHeist[]>([]);
  const [myList, setMyList] = useState<SevynHeist[]>([]);
  const [sharedList, setSharedList] = useState<SevynHeist[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailHeist, setDetailHeist] = useState<SevynHeist | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [off, shared] = await Promise.all([getOfficialHeists(), getSharedHeists()]);
        if (cancelled) return;
        setOfficialList(off);
        setSharedList(shared);
        if (user) {
          const my = await getMyHeists(user.uid);
          if (!cancelled) setMyList(my);
        }
      } catch (err) {
        console.error("Failed to load heists:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const currentList = useMemo(() => {
    return subTab === "official" ? officialList : subTab === "my" ? myList : sharedList;
  }, [subTab, officialList, myList, sharedList]);

  const handleSelectFromDetail = useCallback(() => {
    if (detailHeist) onSelect(detailHeist);
  }, [detailHeist, onSelect]);

  return (
    <>
      <JMSelectAsset<SevynHeist>
        open
        suspendInteractions={detailHeist != null}
        onClose={onClose}
        title="Select a Heist"
        subtitle="Choose a heist for this game"
        tabs={SUB_TABS}
        activeTabId={subTab}
        onTabChange={(id) => setSubTab(id as SubTab)}
        loading={loading}
        emptyMessage="No heists available."
        items={currentList}
        itemKey={(h) => h.id}
        onItemPress={(h) => setDetailHeist(h)}
        renderItem={(heist) => (
          <div className="flex items-center gap-4">
            {heist.backgroundImageUrl ? (
              <div
                className="h-14 w-14 shrink-0 rounded-xl bg-cover bg-center"
                style={{ backgroundImage: `url(${heist.backgroundImageUrl})` }}
              />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-black"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                S7
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white sm:text-xl">{heist.title}</p>
              <p className="mt-0.5 text-base text-white/50">
                {heist.setting.location} &bull; {heist.setting.era}
              </p>
              <p className="mt-0.5 text-sm text-white/35">
                <span style={{ color: accentColor }}>{heist.clients.syndicate1.benefactor}</span>
                {" vs "}
                <span className="text-blue-400">{heist.clients.syndicate2.benefactor}</span>
              </p>
            </div>
          </div>
        )}
      />

      {/* Detail portal — layered above the JMSelectAsset */}
      {detailHeist && typeof document !== "undefined" &&
        createPortal(
          <div className={`fixed inset-0 flex flex-col ${JM_SELECT_ASSET_DETAIL_Z}`}>
            <button
              type="button"
              className="absolute inset-0 z-0 bg-black/80 backdrop-blur-md"
              onClick={() => setDetailHeist(null)}
              aria-label="Close detail"
            />
            <div
              className="relative z-10 mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col"
              style={{
                paddingTop: "max(25px, env(safe-area-inset-top))",
                paddingBottom: "max(25px, env(safe-area-inset-bottom))",
                paddingLeft: "max(25px, env(safe-area-inset-left))",
                paddingRight: "max(25px, env(safe-area-inset-right))",
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/15 bg-neutral-950 shadow-2xl shadow-black/50">
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-black tracking-tight" style={{ color: accentColor }}>
                      {detailHeist.title}
                    </h2>
                    <p className="mt-1 text-base text-white/55">
                      {detailHeist.setting.location} &bull; {detailHeist.setting.era}
                    </p>
                  </div>
                  <JMCloseCircleButton onClick={() => setDetailHeist(null)} />
                </div>

                {/* Scrollable content */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 sm:px-6">
                  {detailHeist.backgroundImageUrl && (
                    <div
                      className="mb-4 h-40 w-full shrink-0 rounded-xl bg-cover bg-center"
                      style={{ backgroundImage: `url(${detailHeist.backgroundImageUrl})` }}
                    />
                  )}

                  <p className="mb-4 text-sm leading-relaxed text-white/80">
                    {detailHeist.briefing.slice(0, 300)}
                    {detailHeist.briefing.length > 300 ? "..." : ""}
                  </p>

                  <div className="mb-4 grid grid-cols-2 gap-3 text-xs text-white/60">
                    <div>
                      <span style={{ color: accentColor }}>{detailHeist.clients.syndicate1.benefactor}</span>
                      <br />vs<br />
                      <span className="text-blue-400">{detailHeist.clients.syndicate2.benefactor}</span>
                    </div>
                    <div>
                      <span className="text-white/40">Assets:</span> {detailHeist.assets.length}<br />
                      <span className="text-white/40">Words:</span>{" "}
                      {detailHeist.words.tier1.length + detailHeist.words.tier2.length + detailHeist.words.tier3.length}
                    </div>
                  </div>

                  <div className="mt-auto pt-4">
                    <GamePrimaryButton onClick={handleSelectFromDetail}>
                      Select This Heist
                    </GamePrimaryButton>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
