"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Save, ShieldUser, Check } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { getAuth } from "@/lib/auth";
import { JMAvatarPreviewAndSelection, type JMAvatarItem } from "@/JMKit";

interface FullUserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  avatarName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  tier: string;
  monthsPaid: number;
  // Gift access
  giftMonthsStarted: string | null;
  giftMonthsRemaining: number;
  lifetimeGift: boolean;
  // Activity
  showsWatched: number;
  storiesRead: number;
  gamesPlayed: number;
  gamesHosted: number;
  cardsViewed: number;
  cardsSent: number;
  shares: number;
  favorites: string[];
  isAdmin: boolean;
}

interface UserEditModalProps {
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * UserEditModal - Modal overlay for viewing/editing user data
 * 
 * Features:
 * - Loads full user data
 * - Grouped fields for clean display
 * - All fields editable
 * - Save button highlights when changes made
 */
export function UserEditModal({ userId, onClose, onSaved }: UserEditModalProps) {
  const { theme } = useJMStyle();
  const [user, setUser] = useState<FullUserData | null>(null);
  const [originalUser, setOriginalUser] = useState<FullUserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);

  // Check if there are unsaved changes
  const hasChanges = user && originalUser && JSON.stringify(user) !== JSON.stringify(originalUser);

  // Fetch full user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const auth = await getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setError("Not authenticated");
          setIsLoading(false);
          return;
        }

        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/admin/users/${userId}`, {
          headers: { "Authorization": `Bearer ${idToken}` },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch user");
        }

        const data = await response.json();
        setUser(data.user);
        setOriginalUser(data.user);
      } catch (err) {
        console.error("Failed to fetch user:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch user");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!user || !hasChanges) return;

    setIsSaving(true);
    setError(null);

    try {
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Not authenticated");
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save user");
      }

      setOriginalUser(user);
      onSaved?.();
      
      // Show success toast
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2500);
    } catch (err) {
      console.error("Failed to save user:", err);
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  }, [user, hasChanges, userId, onSaved]);

  // Update field helper
  const updateField = <K extends keyof FullUserData>(field: K, value: FullUserData[K]) => {
    if (!user) return;
    setUser({ ...user, [field]: value });
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString();
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-2xl max-h-[calc(100vh-6rem)] rounded-2xl border-2 overflow-hidden flex flex-col"
        style={{ 
          backgroundColor: "rgba(20, 20, 20, 1)",
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - fixed at top of modal */}
        <div 
          className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
          style={{ 
            backgroundColor: "rgba(20, 20, 20, 1)",
            borderColor: "rgba(255, 255, 255, 0.15)",
          }}
        >
          <h2 
            className="text-lg font-semibold"
            style={{ color: theme.text.primary }}
          >
            Edit User
          </h2>
          <div className="flex items-center gap-2">
            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="p-2 rounded-lg transition-all disabled:opacity-30"
              style={{ 
                backgroundColor: hasChanges ? `${theme.accents.goldenGlow}20` : 'transparent',
                color: hasChanges ? theme.accents.goldenGlow : theme.text.tertiary,
              }}
              title={hasChanges ? "Save changes" : "No changes to save"}
            >
              <Save size={20} className={isSaving ? "animate-pulse" : ""} />
            </button>
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: theme.text.secondary }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content - scrollable, hidden scrollbar */}
        <div 
          className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {isLoading ? (
            <div className="py-12 text-center">
              <div 
                className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: theme.accents.goldenGlow, borderTopColor: 'transparent' }}
              />
            </div>
          ) : error ? (
            <div 
              className="py-12 text-center"
              style={{ color: theme.semantic.error }}
            >
              {error}
            </div>
          ) : user ? (
            <>
              {/* Profile Section */}
              <Section title="Profile" theme={theme}>
                {/* Avatar at top center */}
                <div className="flex flex-col items-center mb-6">
                  <JMAvatarPreviewAndSelection
                    selectedAvatar={user.avatarName}
                    onAvatarSelect={(avatar: JMAvatarItem) => updateField("avatarName", avatar.filename)}
                    onAvatarRemove={() => updateField("avatarName", null)}
                    size={150}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Display Name"
                    value={user.displayName || ""}
                    onChange={(v) => updateField("displayName", v || null)}
                    theme={theme}
                  />
                  <Field
                    label="Email"
                    value={user.email || ""}
                    onChange={(v) => updateField("email", v || null)}
                    theme={theme}
                    type="email"
                  />
                  <Field
                    label="Photo URL"
                    value={user.photoURL || ""}
                    onChange={(v) => updateField("photoURL", v || null)}
                    theme={theme}
                    type="url"
                  />
                  <div className="flex items-center gap-3">
                    <label 
                      className="text-sm font-medium"
                      style={{ color: theme.text.secondary }}
                    >
                      Admin
                    </label>
                    <button
                      onClick={() => updateField("isAdmin", !user.isAdmin)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
                      style={{ 
                        backgroundColor: user.isAdmin 
                          ? `${theme.accents.goldenGlow}20` 
                          : theme.surfaces.elevated1,
                        color: user.isAdmin 
                          ? theme.accents.goldenGlow 
                          : theme.text.tertiary,
                      }}
                    >
                      <ShieldUser size={16} />
                      {user.isAdmin ? "Yes" : "No"}
                    </button>
                  </div>
                </div>
              </Section>

              {/* Subscription Section */}
              <Section title="Subscription" theme={theme}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: theme.text.secondary }}
                    >
                      Tier
                    </label>
                    <select
                      value={user.tier}
                      onChange={(e) => updateField("tier", e.target.value)}
                      className="w-full px-3 pr-8 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 appearance-none bg-no-repeat"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        color: theme.text.primary,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundPosition: "right 0.75rem center",
                        // @ts-expect-error CSS custom property
                        "--tw-ring-color": theme.accents.goldenGlow,
                      }}
                    >
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  <Field
                    label="Months Paid"
                    value={String(user.monthsPaid)}
                    onChange={(v) => updateField("monthsPaid", parseInt(v) || 0)}
                    theme={theme}
                    type="number"
                  />
                </div>
              </Section>

              {/* Gift Access Section */}
              <Section title="Gift Access" theme={theme}>
                <div className="space-y-4">
                  {/* Lifetime Gift Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div 
                        className="text-sm font-medium"
                        style={{ color: theme.text.secondary }}
                      >
                        Lifetime Gift
                      </div>
                      <div 
                        className="text-xs mt-0.5"
                        style={{ color: theme.text.tertiary }}
                      >
                        Permanent paid access (for testers/influencers)
                      </div>
                    </div>
                    <button
                      onClick={() => updateField("lifetimeGift", !user.lifetimeGift)}
                      className="relative w-12 h-6 rounded-full transition-colors"
                      style={{ 
                        backgroundColor: user.lifetimeGift 
                          ? theme.accents.goldenGlow 
                          : "rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      <div 
                        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                        style={{ 
                          left: user.lifetimeGift ? "calc(100% - 1.25rem)" : "0.25rem",
                        }}
                      />
                    </button>
                  </div>

                  {/* Gift Months (only show if not lifetime) */}
                  {!user.lifetimeGift && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label 
                          className="block text-sm font-medium mb-1.5"
                          style={{ color: theme.text.secondary }}
                        >
                          Gift Months Remaining
                        </label>
                        <input
                          type="number"
                          value={user.giftMonthsRemaining}
                          onChange={(e) => {
                            const newValue = parseInt(e.target.value) || 0;
                            updateField("giftMonthsRemaining", newValue);
                            // Auto-set start date when adding gift months
                            if (newValue > 0 && !user.giftMonthsStarted) {
                              updateField("giftMonthsStarted", new Date().toISOString());
                            }
                          }}
                          min={0}
                          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
                          style={{
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            borderColor: "rgba(255, 255, 255, 0.25)",
                            color: theme.text.primary,
                            // @ts-expect-error CSS custom property
                            "--tw-ring-color": theme.accents.goldenGlow,
                          }}
                        />
                      </div>
                      <div>
                        <label 
                          className="block text-sm font-medium mb-1.5"
                          style={{ color: theme.text.secondary }}
                        >
                          Gift Started
                        </label>
                        <div 
                          className="px-3 py-2 rounded-lg border text-sm"
                          style={{
                            backgroundColor: "rgba(0, 0, 0, 0.3)",
                            borderColor: "rgba(255, 255, 255, 0.15)",
                            color: theme.text.tertiary,
                          }}
                        >
                          {user.giftMonthsStarted 
                            ? new Date(user.giftMonthsStarted).toLocaleDateString()
                            : "Not started"
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info text */}
                  <div 
                    className="text-xs pt-2"
                    style={{ color: theme.text.tertiary }}
                  >
                    {user.lifetimeGift 
                      ? "This user has permanent paid access and will never be charged."
                      : user.giftMonthsRemaining > 0
                        ? `Gift months will be used before billing. ${user.giftMonthsRemaining} month${user.giftMonthsRemaining === 1 ? "" : "s"} remaining.`
                        : "No gift access. User will be billed normally when subscribed."
                    }
                  </div>
                </div>
              </Section>

              {/* Activity Section */}
              <Section title="Activity Stats" theme={theme}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatField
                    label="Shows Watched"
                    value={user.showsWatched}
                    onChange={(v) => updateField("showsWatched", v)}
                    theme={theme}
                  />
                  <StatField
                    label="Stories Read"
                    value={user.storiesRead}
                    onChange={(v) => updateField("storiesRead", v)}
                    theme={theme}
                  />
                  <StatField
                    label="Games Played"
                    value={user.gamesPlayed}
                    onChange={(v) => updateField("gamesPlayed", v)}
                    theme={theme}
                  />
                  <StatField
                    label="Games Hosted"
                    value={user.gamesHosted}
                    onChange={(v) => updateField("gamesHosted", v)}
                    theme={theme}
                  />
                  <StatField
                    label="Cards Viewed"
                    value={user.cardsViewed}
                    onChange={(v) => updateField("cardsViewed", v)}
                    theme={theme}
                  />
                  <StatField
                    label="Cards Sent"
                    value={user.cardsSent}
                    onChange={(v) => updateField("cardsSent", v)}
                    theme={theme}
                  />
                  <StatField
                    label="Shares"
                    value={user.shares}
                    onChange={(v) => updateField("shares", v)}
                    theme={theme}
                  />
                  <div className="flex flex-col">
                    <label 
                      className="text-xs font-medium mb-1"
                      style={{ color: theme.text.tertiary }}
                    >
                      Favorites
                    </label>
                    <div 
                      className="text-lg font-semibold"
                      style={{ color: theme.text.primary }}
                    >
                      {user.favorites.length}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Metadata Section */}
              <Section title="Metadata" theme={theme}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label 
                      className="block text-xs font-medium mb-1"
                      style={{ color: theme.text.tertiary }}
                    >
                      User ID
                    </label>
                    <div 
                      className="text-sm font-mono"
                      style={{ color: theme.text.secondary }}
                    >
                      {user.uid}
                    </div>
                  </div>
                  <div>
                    <label 
                      className="block text-xs font-medium mb-1"
                      style={{ color: theme.text.tertiary }}
                    >
                      Created At
                    </label>
                    <div 
                      className="text-sm"
                      style={{ color: theme.text.secondary }}
                    >
                      {formatDate(user.createdAt)}
                    </div>
                  </div>
                  <div>
                    <label 
                      className="block text-xs font-medium mb-1"
                      style={{ color: theme.text.tertiary }}
                    >
                      Updated At
                    </label>
                    <div 
                      className="text-sm"
                      style={{ color: theme.text.secondary }}
                    >
                      {formatDate(user.updatedAt)}
                    </div>
                  </div>
                </div>
              </Section>
            </>
          ) : null}
        </div>
      </div>

      {/* Success Toast */}
      <div 
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-xl border-2 shadow-lg transition-all duration-300 ${
          showSaveToast 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ 
          backgroundColor: "rgba(20, 20, 20, 0.95)",
          borderColor: theme.semantic.success,
          zIndex: 60,
        }}
      >
        <div 
          className="flex items-center justify-center w-6 h-6 rounded-full"
          style={{ backgroundColor: `${theme.semantic.success}30` }}
        >
          <Check size={14} style={{ color: theme.semantic.success }} />
        </div>
        <span 
          className="text-sm font-medium"
          style={{ color: theme.text.primary }}
        >
          Changes saved successfully
        </span>
      </div>
    </div>
  );
}

// Section wrapper component
function Section({ 
  title, 
  theme, 
  children 
}: { 
  title: string; 
  theme: ReturnType<typeof useJMStyle>["theme"]; 
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 
        className="text-sm font-semibold mb-3 uppercase tracking-wider"
        style={{ color: theme.accents.goldenGlow }}
      >
        {title}
      </h3>
      <div 
        className="p-4 rounded-xl border-2"
        style={{ 
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          borderColor: "rgba(255, 255, 255, 0.18)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Text field component
function Field({
  label,
  value,
  onChange,
  theme,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: ReturnType<typeof useJMStyle>["theme"];
  type?: "text" | "email" | "url" | "number";
}) {
  return (
    <div>
      <label 
        className="block text-sm font-medium mb-1.5"
        style={{ color: theme.text.secondary }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          borderColor: "rgba(255, 255, 255, 0.25)",
          color: theme.text.primary,
          // @ts-expect-error CSS custom property
          "--tw-ring-color": theme.accents.goldenGlow,
        }}
      />
    </div>
  );
}

// Numeric stat field component
function StatField({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  theme: ReturnType<typeof useJMStyle>["theme"];
}) {
  return (
    <div className="flex flex-col">
      <label 
        className="text-xs font-medium mb-1"
        style={{ color: theme.text.tertiary }}
      >
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={0}
        className="w-full px-2 py-1 rounded border text-lg font-semibold focus:outline-none focus:ring-1"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          borderColor: "rgba(255, 255, 255, 0.25)",
          color: theme.text.primary,
          // @ts-expect-error CSS custom property
          "--tw-ring-color": theme.accents.goldenGlow,
        }}
      />
    </div>
  );
}
