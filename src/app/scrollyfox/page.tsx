"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { JMAppHeader } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { AdminGate } from "@/lib/AdminGate";
import { HeroEditorModal } from "./HeroEditorModal";

function ScrollyFoxHomeContent() {
  const { theme } = useJMStyle();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader />

      <div className="relative z-10 flex w-full items-center justify-between px-[clamp(16px,5vw,50px)] pt-6 pb-2">
        <h1
          className="text-2xl font-bold"
          style={{ color: theme.text.primary }}
        >
          ScrollyFox
        </h1>
        {/* TODO: replace with animating ScrollyFox logo asset */}
        <div
          className="text-sm font-semibold tracking-wide"
          style={{ color: theme.accents.neonPink }}
        >
          SCROLLYFOX
        </div>
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col px-[clamp(16px,5vw,50px)] py-12">
        {/* Empty state — no ScrollyFoxes yet */}
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <p
            className="max-w-md text-base"
            style={{ color: theme.text.secondary }}
          >
            Build scroll-driven stories, one-pagers, and interactive adventures.
          </p>
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-3 rounded-2xl border-2 px-6 py-4 transition-all duration-150"
            style={{
              borderColor: theme.accents.neonPink,
              color: theme.accents.neonPink,
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.accents.neonPink;
              e.currentTarget.style.color = theme.surfaces.base;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = theme.accents.neonPink;
            }}
          >
            <Plus size={24} />
            <span className="text-lg font-semibold">
              Create your first ScrollyFox
            </span>
          </button>
        </div>
      </main>

      <HeroEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />
    </div>
  );
}

export default function ScrollyFoxHomePage() {
  return (
    <AdminGate redirectTo="/auth">
      <ScrollyFoxHomeContent />
    </AdminGate>
  );
}
