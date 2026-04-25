"use client";

import { useState } from "react";
import { Lollipop } from "lucide-react";
import { AdminGate } from "@/lib/AdminGate";
import { useJMStyle } from "@/JMStyle";
import { JMAppHeader, JMAdminDropdown, type AdminFocus } from "@/JMKit";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminAvatarsPanel } from "./AdminAvatarsPanel";
import { AdminShowsPanel } from "./AdminShowsPanel";
import { AdminFeaturedPanel } from "./AdminFeaturedPanel";
import { AdminAlertsPanel } from "./AdminAlertsPanel";
import { AdminBrandsPanel } from "./AdminBrandsPanel";
import { AdminHomeRowsPanel } from "./AdminHomeRowsPanel";
import { AdminArtistsPanel } from "./AdminArtistsPanel";
import { AdminAuctionsPanel } from "./AdminAuctionsPanel";
import { AdminStoriesPanel } from "./AdminStoriesPanel";
import { AdminGamesPanel } from "./AdminGamesPanel";
import { AdminLevelsPanel } from "./AdminLevelsPanel";
import { AdminPointsPanel } from "./AdminPointsPanel";
import { AdminAIPersonasPanel } from "./AdminAIPersonasPanel";
import { AdminDataCleanupPanel } from "./AdminDataCleanupPanel";

function AdminContent() {
  const { theme } = useJMStyle();
  const [focus, setFocus] = useState<AdminFocus>(null);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Header */}
      <JMAppHeader />

      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ 
          backgroundImage: "url('/images/bgs/BG-Signup.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <main className="relative mx-auto flex w-[80%] flex-col py-12">
        {/* Admin toolbar */}
        <div 
          className="opacity-0 animate-fade-in-up animation-delay-200 rounded-2xl border backdrop-blur-md"
          style={{ 
            backgroundColor: `${theme.surfaces.base}ee`,
            borderColor: theme.surfaces.elevated2,
          }}
        >
          <div 
            className="px-8 py-6 flex items-center justify-between"
          >
            {/* Left: Title with icon */}
            <div className="flex items-center gap-3">
              <Lollipop
                size={28}
                color={theme.accents.goldenGlow}
                strokeWidth={2}
              />
              <h1
                className="text-xl font-semibold"
                style={{ color: theme.text.primary }}
              >
                Inventing Room
              </h1>
            </div>

            {/* Right: Focus dropdown */}
            <JMAdminDropdown value={focus} onChange={setFocus} />
          </div>
        </div>

        {/* Content panels based on focus */}
        {focus === "featured" && <AdminFeaturedPanel />}
        {focus === "homerows" && <AdminHomeRowsPanel />}
        {focus === "alert" && <AdminAlertsPanel />}
        {focus === "brands" && <AdminBrandsPanel />}
        {focus === "artist" && <AdminArtistsPanel />}
        {focus === "auction" && <AdminAuctionsPanel />}
        {focus === "users" && <AdminUsersPanel />}
        {focus === "avatars" && <AdminAvatarsPanel />}
        {focus === "show" && <AdminShowsPanel />}
        {focus === "story" && <AdminStoriesPanel />}
        {focus === "game" && <AdminGamesPanel />}
        {focus === "levels" && <AdminLevelsPanel />}
        {focus === "points" && <AdminPointsPanel />}
        {focus === "aipersonas" && <AdminAIPersonasPanel />}
        {focus === "cleanup" && <AdminDataCleanupPanel />}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGate redirectTo="/auth">
      <AdminContent />
    </AdminGate>
  );
}
