"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldUser, User, Mail } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useJMStyle } from "@/JMStyle";
import { JMAppHeader, JMAvatarPreviewAndSelection, type JMAvatarItem } from "@/JMKit";
import { getAuth } from "@/lib/auth";

export default function ProfilePage() {
  const { user, isAdmin, isLoading } = useAuth();
  const { theme } = useJMStyle();
  const [avatarName, setAvatarName] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarSaving, setAvatarSaving] = useState(false);

  // Fetch user's avatar on mount
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) return;
      
      try {
        const auth = await getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/user/avatar", {
          headers: { "Authorization": `Bearer ${idToken}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          setAvatarName(data.avatarName);
        }
      } catch (error) {
        console.error("Failed to fetch avatar:", error);
      } finally {
        setAvatarLoading(false);
      }
    };

    if (user && !isLoading) {
      fetchAvatar();
    }
  }, [user, isLoading]);

  // Save avatar to server
  const saveAvatar = useCallback(async (newAvatarName: string | null) => {
    if (!user) return;
    
    setAvatarSaving(true);
    try {
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/user/avatar", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatarName: newAvatarName }),
      });
      
      if (response.ok) {
        setAvatarName(newAvatarName);
      } else {
        console.error("Failed to save avatar");
      }
    } catch (error) {
      console.error("Failed to save avatar:", error);
    } finally {
      setAvatarSaving(false);
    }
  }, [user]);

  // Handle avatar selection
  const handleAvatarSelect = useCallback((avatar: JMAvatarItem) => {
    saveAvatar(avatar.filename);
  }, [saveAvatar]);

  // Handle avatar removal
  const handleAvatarRemove = useCallback(() => {
    saveAvatar(null);
  }, [saveAvatar]);

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: theme.surfaces.base }}
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: theme.accents.neonPink, borderTopColor: 'transparent' }}
          />
          <p className="font-mono text-sm" style={{ color: theme.text.secondary }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
    return (
      <div 
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: theme.surfaces.base }}
      >
        <div 
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: theme.accents.neonPink, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const displayName = user.displayName || "User";
  const email = user.email || "No email";

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
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <main className="relative z-10 mx-auto flex max-w-md flex-col px-6 py-12">
        {/* Profile card */}
        <div 
          className="opacity-0 animate-fade-in-up animation-delay-200 rounded-2xl border overflow-hidden backdrop-blur-md"
          style={{ 
            backgroundColor: `${theme.surfaces.base}ee`,
            borderColor: theme.surfaces.elevated2,
          }}
        >
         

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center">
              <JMAvatarPreviewAndSelection
                selectedAvatar={avatarName}
                onAvatarSelect={handleAvatarSelect}
                onAvatarRemove={handleAvatarRemove}
                isLoading={avatarLoading || avatarSaving}
                size={160}
              />
              {avatarSaving && (
                <p 
                  className="mt-2 text-xs"
                  style={{ color: theme.text.tertiary }}
                >
                  Saving...
                </p>
              )}
            </div>

            {/* Display Name */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
                style={{ color: theme.text.tertiary }}
              >
                <User size={14} />
                Name
              </label>
              <div 
                className="rounded-xl border px-4 py-3"
                style={{ 
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                  color: theme.text.primary,
                }}
              >
                {displayName}
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
                style={{ color: theme.text.tertiary }}
              >
                <Mail size={14} />
                Email
              </label>
              <div 
                className="rounded-xl border px-4 py-3"
                style={{ 
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                  color: theme.text.primary,
                }}
              >
                {email}
              </div>
            </div>

            {/* Admin Status */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
                style={{ color: theme.text.tertiary }}
              >
                <ShieldUser size={14} />
                Role
              </label>
              <div 
                className="rounded-xl border px-4 py-3 flex items-center gap-3"
                style={{ 
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                }}
              >
                {isAdmin ? (
                  <>
                    <ShieldUser 
                      size={20} 
                      color={theme.accents.goldenGlow}
                    />
                    <span style={{ color: theme.accents.goldenGlow, fontWeight: 600 }}>
                      Admin
                    </span>
                  </>
                ) : (
                  <span style={{ color: theme.text.secondary }}>
                    Member
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sign out link */}
        <div className="mt-8 text-center">
          <button
            onClick={async () => {
              const { signOut } = await import("@/lib/auth");
              await signOut();
              window.location.href = "/auth";
            }}
            className="text-sm font-medium hover:underline"
            style={{ color: theme.accents.neonPink }}
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
