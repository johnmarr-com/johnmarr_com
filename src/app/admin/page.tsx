"use client";

import { useState } from "react";
import { ShieldUser, Eye, ChevronDown } from "lucide-react";
import { AdminGate } from "@/lib/AdminGate";
import { useAuth, type UserTier } from "@/lib/AuthProvider";
import { useJMStyle } from "@/JMStyle";
import { JMAppHeader, JMAdminDropdown, type AdminFocus } from "@/JMKit";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminAvatarsPanel } from "./AdminAvatarsPanel";
import { AdminShowsPanel } from "./AdminShowsPanel";
import { AdminFeaturedPanel } from "./AdminFeaturedPanel";
import { AdminAlertsPanel } from "./AdminAlertsPanel";
import { AdminBrandsPanel } from "./AdminBrandsPanel";

function AdminContent() {
  const { theme } = useJMStyle();
  const { adminViewAs, setAdminViewAs } = useAuth();
  const [focus, setFocus] = useState<AdminFocus>(null);
  const [viewAsOpen, setViewAsOpen] = useState(false);

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

      <main className="relative z-10 mx-auto flex w-[80%] flex-col py-12">
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
              <ShieldUser 
                size={28} 
                color={theme.accents.goldenGlow}
                strokeWidth={2}
              />
              <h1 
                className="text-xl font-semibold"
                style={{ color: theme.text.primary }}
              >
                Admin Dashboard
              </h1>
            </div>

            {/* Right: Dropdowns */}
            <div className="flex items-center gap-3">
              {/* View As dropdown */}
              <div className="relative">
                <button
                  onClick={() => setViewAsOpen(!viewAsOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-150"
                  style={{
                    backgroundColor: adminViewAs ? theme.surfaces.elevated1 : theme.surfaces.base,
                    borderColor: adminViewAs ? theme.accents.goldenGlow : theme.surfaces.elevated2,
                    color: theme.text.primary,
                  }}
                >
                  <Eye size={16} style={{ color: adminViewAs ? theme.accents.goldenGlow : theme.text.tertiary }} />
                  <span className="text-sm">
                    {adminViewAs ? `View: ${adminViewAs.charAt(0).toUpperCase() + adminViewAs.slice(1)}` : "View As"}
                  </span>
                  <ChevronDown 
                    size={14} 
                    className={`transition-transform duration-200 ${viewAsOpen ? "rotate-180" : ""}`}
                    style={{ color: theme.text.tertiary }}
                  />
                </button>
                
                {viewAsOpen && (
                  <>
                    {/* Backdrop to close */}
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setViewAsOpen(false)}
                    />
                    {/* Menu */}
                    <div
                      className="absolute top-full right-0 mt-1 overflow-hidden rounded-lg shadow-xl z-50"
                      style={{
                        backgroundColor: theme.surfaces.base,
                        border: `1px solid ${theme.surfaces.elevated2}`,
                        minWidth: "140px",
                      }}
                    >
                      {(["free", "paid", null] as (UserTier | null)[]).map((tier, index) => (
                        <button
                          key={tier ?? "reset"}
                          onClick={() => {
                            setAdminViewAs(tier);
                            setViewAsOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
                          style={{
                            color: adminViewAs === tier ? theme.accents.goldenGlow : theme.text.primary,
                            borderTop: index > 0 ? `1px solid ${theme.surfaces.elevated2}` : undefined,
                          }}
                        >
                          {tier === null ? "Reset (Admin)" : tier === "free" ? "Free User" : "Paid User"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Focus dropdown */}
              <JMAdminDropdown value={focus} onChange={setFocus} />
            </div>
          </div>
        </div>

        {/* Content panels based on focus */}
        {focus === "featured" && <AdminFeaturedPanel />}
        {focus === "alert" && <AdminAlertsPanel />}
        {focus === "brands" && <AdminBrandsPanel />}
        {focus === "users" && <AdminUsersPanel />}
        {focus === "avatars" && <AdminAvatarsPanel />}
        {focus === "show" && <AdminShowsPanel />}
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
