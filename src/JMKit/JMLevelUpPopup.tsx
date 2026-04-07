"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { useJMStyle } from "@/JMStyle";
import { getLevelByNumber } from "@/lib/levels";
import type { UserLevel } from "@/lib/levels";
import { Dialog, DialogContent } from "./JMDialog";
import { JMConfettiOverlay } from "./JMConfettiOverlay";
import { getAuth } from "@/lib/auth";

export function JMLevelUpPopup() {
  const { user, level, levelledUp, refreshUserData } = useAuth();
  const { theme } = useJMStyle();
  const [open, setOpen] = useState(false);
  const [levelData, setLevelData] = useState<UserLevel | null>(null);
  useEffect(() => {
    if (!levelledUp || !user) return;

    getLevelByNumber(level).then((data) => {
      if (data) {
        setLevelData(data);
        setOpen(true);
      }
    });
  }, [levelledUp, user, level]);

  const dismiss = useCallback(async () => {
    setOpen(false);

    try {
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const idToken = await currentUser.getIdToken();
      await fetch("/api/user/level-up-dismiss", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      await refreshUserData();
    } catch (err) {
      console.error("Failed to dismiss level-up:", err);
    }
  }, [refreshUserData]);

  if (!open || !levelData) return null;

  const iconUrl = levelData.iconIsometricURL || levelData.iconRealisticURL;

  return (
    <>
      <JMConfettiOverlay />

      <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
        <DialogContent
          className="border-0 bg-transparent shadow-none max-w-md overflow-visible"
          overlayClassName="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          hideCloseButton
        >
          <div className="relative flex flex-col items-center text-center py-8 px-4">
          {/* Level icon */}
          {iconUrl && (
            <div className="mb-6">
              <Image
                src={iconUrl}
                alt={levelData.title}
                width={512}
                height={512}
                className="drop-shadow-2xl animate-badge-pulse"
                style={{ maxWidth: "350px", height: "auto" }}
                unoptimized
              />
            </div>
          )}

          <p
            className="text-2xl font-black tracking-wider uppercase mb-2"
            style={{ color: theme.accents.goldenGlow }}
          >
            CONGRATS
          </p>

          <p
            className="text-lg mb-4"
            style={{ color: theme.text.secondary }}
          >
            You reached a new level!
          </p>

          <button
            onClick={dismiss}
            className="mt-8 px-8 py-3 rounded-full font-bold text-sm uppercase tracking-wider transition-transform hover:scale-105"
            style={{
              backgroundColor: theme.accents.goldenGlow,
              color: "#000",
            }}
          >
            Continue
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
