"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { AdminGate } from "@/lib/AdminGate";
import { JMAppHeader, JMAdminDropdown, type AdminFocus } from "@/JMKit";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminAvatarsPanel } from "./AdminAvatarsPanel";
import { AdminShowsPanel } from "./AdminShowsPanel";
import { AdminFeaturedPanel } from "./AdminFeaturedPanel";
import { AdminAlertsPanel } from "./AdminAlertsPanel";
import { AdminBrandsPanel } from "./AdminBrandsPanel";
import { AdminRowCollectionsPanel } from "./AdminRowCollectionsPanel";
import { AdminPagesPanel } from "./AdminPagesPanel";
import { AdminArtistsPanel } from "./AdminArtistsPanel";
import { AdminAuctionsPanel } from "./AdminAuctionsPanel";
import { AdminStoriesPanel } from "./AdminStoriesPanel";
import { AdminGamesPanel } from "./AdminGamesPanel";
import { AdminLevelsPanel } from "./AdminLevelsPanel";
import { AdminPointsPanel } from "./AdminPointsPanel";
import { AdminAIPersonasPanel } from "./AdminAIPersonasPanel";
import { AdminDataCleanupPanel } from "./AdminDataCleanupPanel";
import { AdminAgentsPanel } from "./AdminAgentsPanel";
import { AdminTriviaReviewPanel } from "./AdminTriviaReviewPanel";

function AdminContent() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [focus, setFocus] = useState<AdminFocus>(null);

  const handleFocusChange = (next: AdminFocus) => {
    if (next === "scrollyfox") {
      router.push("/scrollyfox");
      return;
    }
    setFocus(next);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Header */}
      <JMAppHeader />

      <div className="relative z-10 flex w-full min-h-[112.5px] items-center justify-center bg-black/40 px-[clamp(12px,5vw,50px)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic height; local asset */}
        <img
          src="/images/banners/Inventing-Studio-5.png"
          alt="Inventing.Studio"
          className="h-auto w-full max-w-[300px] object-contain"
        />
      </div>

      {isAdmin && (
        <div className="relative z-10 flex w-full justify-center px-[clamp(12px,5vw,50px)] pt-1 pb-4">
          <JMAdminDropdown value={focus} onChange={handleFocusChange} />
        </div>
      )}

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
        {/* Content panels based on focus */}
        {focus === "featured" && <AdminFeaturedPanel />}
        {focus === "rowcollections" && <AdminRowCollectionsPanel />}
        {focus === "pages" && <AdminPagesPanel />}
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
        {focus === "agents" && <AdminAgentsPanel />}
        {focus === "trivia_review" && <AdminTriviaReviewPanel />}
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
