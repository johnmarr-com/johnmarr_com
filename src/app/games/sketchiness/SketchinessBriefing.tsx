"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { JMBannerText } from "@/JMKit";
import JMAvatarView from "@/JMKit/JMAvatarView";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import type { SketchinessMission } from "@/lib/sketchiness-missions";
import MissionPicker from "./MissionPicker";

const AI_PLAYER_ID = "ai-silicon";

interface PlayerInfo {
  uid: string;
  gamertag: string;
  isAI: boolean;
  avatarName?: string | undefined;
}

function SortableAgent({
  info,
  index,
  visible,
}: {
  info: PlayerInfo;
  index: number;
  visible: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: info.uid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-white/5 px-3 py-2 transition-all duration-500 ${
        isDragging ? "border-green-400/40 shadow-lg shadow-green-400/10" : "border-white/10"
      } ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}
    >
      <span className="w-6 text-center text-xs font-bold text-green-400/60">
        {index + 1}
      </span>
      <div className="h-8 w-8 shrink-0">
        {info.isAI ? (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-green-400/20 text-xs font-bold text-green-400">
            AI
          </div>
        ) : info.avatarName ? (
          <JMAvatarView width={32} avatarName={info.avatarName} />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
            {info.gamertag.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span className="flex-1 text-sm font-bold text-white">
        {info.gamertag}
      </span>
      {info.isAI && (
        <span className="rounded-full bg-green-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-green-400/60">
          Bot
        </span>
      )}
      <button
        {...attributes}
        {...listeners}
        className="touch-none rounded p-1 text-white/20 hover:text-white/50"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

function StaticAgent({
  info,
  index,
  visible,
}: {
  info: PlayerInfo;
  index: number;
  visible: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-all duration-500 ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
      }`}
    >
      <span className="w-6 text-center text-xs font-bold text-green-400/60">
        {index + 1}
      </span>
      <div className="h-8 w-8 shrink-0">
        {info.isAI ? (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-green-400/20 text-xs font-bold text-green-400">
            AI
          </div>
        ) : info.avatarName ? (
          <JMAvatarView width={32} avatarName={info.avatarName} />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
            {info.gamertag.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span className="text-sm font-bold text-white">
        {info.gamertag}
      </span>
      {info.isAI && (
        <span className="rounded-full bg-green-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-green-400/60">
          Bot
        </span>
      )}
    </div>
  );
}

interface SketchinessBriefingProps {
  players: GameSessionPlayer[];
  playOrder: string[];
  aiPlayerId: string | null;
  onReady: (mission: SketchinessMission | null) => void;
  onReorder: (newOrder: string[]) => void;
  isHost: boolean;
}

export default function SketchinessBriefing({
  players,
  playOrder,
  aiPlayerId,
  onReady,
  onReorder,
  isHost,
}: SketchinessBriefingProps) {
  const [localOrder, setLocalOrder] = useState(playOrder);
  const [revealedCount, setRevealedCount] = useState(0);
  const [selectedMission, setSelectedMission] = useState<SketchinessMission | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const allRevealed = revealedCount >= localOrder.length;

  // Sync from props when Firestore pushes a new order (e.g. from another client)
  useEffect(() => {
    setLocalOrder(playOrder);
  }, [playOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  useEffect(() => {
    if (revealedCount >= localOrder.length) return;
    const timer = setTimeout(() => {
      setRevealedCount((c) => c + 1);
    }, 600);
    return () => clearTimeout(timer);
  }, [revealedCount, localOrder.length]);

  const getPlayerInfo = useCallback(
    (uid: string): PlayerInfo => {
      if (uid === AI_PLAYER_ID || uid === aiPlayerId) {
        return { gamertag: "Agent SILICON", isAI: true, uid, avatarName: undefined };
      }
      const p = players.find((pl) => pl.uid === uid);
      return { gamertag: p?.gamertag ?? "Unknown", isAI: false, uid, avatarName: p?.avatarName };
    },
    [players, aiPlayerId],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = localOrder.indexOf(String(active.id));
      const newIdx = localOrder.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return;

      const newOrder = arrayMove(localOrder, oldIdx, newIdx);
      setLocalOrder(newOrder);
      onReorder(newOrder);
    },
    [localOrder, onReorder],
  );

  const handleMissionSelect = useCallback((mission: SketchinessMission) => {
    setSelectedMission(mission);
    setPickerOpen(false);
  }, []);

  const handleBeginMission = useCallback(async () => {
    if (launching) return;
    setLaunching(true);
    await onReady(selectedMission);
    setLaunching(false);
  }, [launching, selectedMission, onReady]);

  const humanCount = players.length;

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="flex w-full max-w-lg mx-auto flex-1 flex-col items-center justify-start gap-5 overflow-y-auto px-6 py-10">
        {/* Mission header */}
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-green-400/60">
            Classified Briefing
          </p>
          <JMBannerText borderColor="rgba(34, 197, 94, 0.4)">
            <h1 className="px-4 py-2 text-xl font-black uppercase tracking-wider text-green-400">
              Mission Order
            </h1>
          </JMBannerText>
        </div>

        {/* Agent order */}
        <div className="w-full space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
            Transmission Order
            {isHost && allRevealed && (
              <span className="ml-2 normal-case tracking-normal text-green-400/40">
                — drag to reorder
              </span>
            )}
          </p>

          {isHost && allRevealed ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localOrder}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1.5">
                  {localOrder.map((uid, i) => (
                    <SortableAgent
                      key={uid}
                      info={getPlayerInfo(uid)}
                      index={i}
                      visible={true}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex flex-col gap-1.5">
              {localOrder.map((uid, i) => (
                <StaticAgent
                  key={uid}
                  info={getPlayerInfo(uid)}
                  index={i}
                  visible={i < revealedCount}
                />
              ))}
            </div>
          )}
        </div>

        {/* Host: mission picker + begin button (after agents revealed) */}
        {allRevealed && (
          <div className="w-full space-y-3 pt-2">
            {isHost ? (
              <>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors hover:bg-white/10"
                >
                  <span className="text-white/60">
                    {selectedMission ? (
                      <>
                        <span className="font-bold text-green-400">
                          {selectedMission.title}
                        </span>{" "}
                        <span className="text-white/30">
                          ({selectedMission.maxPlayers}p)
                        </span>
                      </>
                    ) : (
                      "Select a Mission"
                    )}
                  </span>
                  <FileText className="h-4 w-4 text-white/30" />
                </button>

                <button
                  onClick={handleBeginMission}
                  disabled={launching || !selectedMission}
                  className="w-full rounded-xl bg-green-500 py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {launching ? (
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  ) : (
                    "Begin Mission"
                  )}
                </button>

                {pickerOpen && (
                  <MissionPicker
                    playerCount={humanCount}
                    onSelect={handleMissionSelect}
                    onClose={() => setPickerOpen(false)}
                  />
                )}
              </>
            ) : (
              <p className="text-center text-sm text-white/40">
                Waiting for host to begin the mission...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
