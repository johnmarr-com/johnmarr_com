"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialMissions,
  getMyMissions,
  getSharedMissions,
  type MegaSketchyMission,
} from "@/lib/megasketchy-missions";
import { JMSelectAsset, JM_SELECT_ASSET_DETAIL_Z } from "@/JMKit";
import MissionDetailView from "./missions/MissionDetailView";

type SubTab = "official" | "my" | "shared";

interface MissionPickerProps {
  playerCount: number;
  onSelect: (mission: MegaSketchyMission) => void;
  onClose: () => void;
}

export default function MissionPicker({
  playerCount,
  onSelect,
  onClose,
}: MissionPickerProps) {
  const { user, userTier, isAdmin } = useAuth();
  const canCreate = isAdmin || userTier === "pro";

  const [subTab, setSubTab] = useState<SubTab>("official");
  const [officialList, setOfficialList] = useState<MegaSketchyMission[]>([]);
  const [myList, setMyList] = useState<MegaSketchyMission[]>([]);
  const [sharedList, setSharedList] = useState<MegaSketchyMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailMission, setDetailMission] = useState<MegaSketchyMission | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [off, shared] = await Promise.all([
          getOfficialMissions(),
          getSharedMissions(),
        ]);
        if (cancelled) return;
        setOfficialList(off);
        setSharedList(shared);
        if (user) {
          const my = await getMyMissions(user.uid);
          if (!cancelled) setMyList(my);
        }
      } catch (err) {
        console.error("Failed to load missions:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filterByCount = useCallback(
    (list: MegaSketchyMission[]) => list.filter((m) => m.maxPlayers >= playerCount),
    [playerCount],
  );

  const currentList = useMemo(() => {
    const raw = subTab === "official" ? officialList : subTab === "my" ? myList : sharedList;
    return filterByCount(raw);
  }, [subTab, officialList, myList, sharedList, filterByCount]);

  const handleSelect = useCallback(
    (mission: MegaSketchyMission) => {
      onSelect(mission);
    },
    [onSelect],
  );

  const SUB_TABS: {
    id: SubTab;
    label: string;
    visible: boolean;
  }[] = useMemo(
    () => [
      { id: "official", label: "Official", visible: true },
      { id: "my", label: "My missions", visible: canCreate },
      { id: "shared", label: "Shared", visible: true },
    ],
    [canCreate],
  );

  return (
    <>
      <JMSelectAsset<MegaSketchyMission>
        open
        suspendInteractions={detailMission != null}
        onClose={onClose}
        title="Choose a mission"
        subtitle={`Missions for ${playerCount}+ players`}
        tabs={SUB_TABS}
        activeTabId={subTab}
        onTabChange={(id) => setSubTab(id as SubTab)}
        loading={loading}
        emptyMessage={`No missions for ${playerCount} players.`}
        items={currentList}
        itemKey={(m) => m.id}
        onItemPress={(m) => setDetailMission(m)}
        renderItem={(m) => (
          <div className="flex items-center gap-4">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-green-500/25 to-emerald-600/20 ring-1 ring-white/15">
              <FileText className="h-10 w-10 text-green-300/90" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white sm:text-xl">{m.title}</p>
              <p className="mt-1 text-base text-white/50">
                {m.maxPlayers} players · {m.creatorGamertag}
              </p>
            </div>
          </div>
        )}
      />

      {detailMission != null &&
        typeof document !== "undefined" &&
        createPortal(
          <MissionDetailView
            mission={detailMission}
            truncateTo={playerCount}
            overlayClassName={JM_SELECT_ASSET_DETAIL_Z}
            onClose={() => setDetailMission(null)}
            onSelect={handleSelect}
          />,
          document.body,
        )}
    </>
  );
}
