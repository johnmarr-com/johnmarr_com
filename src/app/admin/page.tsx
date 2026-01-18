"use client";

import { ShieldUser } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { AdminGate } from "@/lib/AdminGate";
import { useJMStyle } from "@/JMStyle";
import { JMAppHeader } from "@/JMKit";

function AdminContent() {
  const { user } = useAuth();
  const { theme } = useJMStyle();

  const displayName = user?.displayName || "Admin";

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
        {/* Admin header */}
        <div 
          className="opacity-0 animate-fade-in-up animation-delay-200 rounded-2xl border overflow-hidden backdrop-blur-md"
          style={{ 
            backgroundColor: `${theme.surfaces.base}ee`,
            borderColor: theme.surfaces.elevated2,
          }}
        >
          {/* Header */}
          <div 
            className="px-8 py-6 border-b flex items-center gap-4"
            style={{ borderColor: theme.surfaces.elevated2 }}
          >
            <ShieldUser 
              size={32} 
              color={theme.accents.goldenGlow}
              strokeWidth={2}
            />
            <div>
              <h1 
                className="text-2xl font-semibold"
                style={{ color: theme.text.primary }}
              >
                Admin Dashboard
              </h1>
              <p 
                className="mt-1 text-sm"
                style={{ color: theme.text.tertiary }}
              >
                Welcome, {displayName}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <p style={{ color: theme.text.secondary }}>
              Admin features coming soon...
            </p>
          </div>
        </div>
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
