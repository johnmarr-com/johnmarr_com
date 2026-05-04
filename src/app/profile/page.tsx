"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ShieldUser, User, Mail, Gamepad2, Pencil, Check, X, Loader2, Trophy } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { useJMStyle } from "@/JMStyle";
import { JMAppHeader, JMAvatarPreviewAndSelection, type JMAvatarItem } from "@/JMKit";
import { getAuth } from "@/lib/auth";
import { getLevelByNumber, getLevelIconURL, type UserLevel } from "@/lib/levels";
import type { JMTheme } from "@/JMStyle/themes";

const GAMERTAG_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

type GamertagStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function ProfilePage() {
  const { user, isAdmin, isLoading, gamertag, level, points, refreshUserData } = useAuth();
  const { theme } = useJMStyle();
  const [avatarName, setAvatarName] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarSaving, setAvatarSaving] = useState(false);

  // Editable field states
  const [editingField, setEditingField] = useState<"name" | "email" | "gamertag" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [fieldSuccess, setFieldSuccess] = useState<string | null>(null);

  // Gamertag availability
  const [gamertagStatus, setGamertagStatus] = useState<GamertagStatus>("idle");
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Firestore level data
  const [levelData, setLevelData] = useState<UserLevel | null>(null);
  const [nextLevelData, setNextLevelData] = useState<UserLevel | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchLevel() {
      const [current, next] = await Promise.all([
        getLevelByNumber(level),
        getLevelByNumber(level + 1),
      ]);
      if (!cancelled) {
        setLevelData(current);
        setNextLevelData(next);
      }
    }
    fetchLevel();
    return () => { cancelled = true; };
  }, [level]);

  useEffect(() => {
    if (user && !isLoading) refreshUserData();
  }, [user, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) return;
      try {
        const auth = await getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/user/avatar", {
          headers: { Authorization: `Bearer ${idToken}` },
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
    if (user && !isLoading) fetchAvatar();
  }, [user, isLoading]);

  const saveAvatar = useCallback(
    async (newAvatarName: string | null) => {
      if (!user) return;
      setAvatarSaving(true);
      try {
        const auth = await getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/user/avatar", {
          method: "PUT",
          headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ avatarName: newAvatarName }),
        });
        if (response.ok) setAvatarName(newAvatarName);
      } catch (error) {
        console.error("Failed to save avatar:", error);
      } finally {
        setAvatarSaving(false);
      }
    },
    [user],
  );

  const handleAvatarSelect = useCallback((avatar: JMAvatarItem) => saveAvatar(avatar.filename), [saveAvatar]);
  const handleAvatarRemove = useCallback(() => saveAvatar(null), [saveAvatar]);

  // -- Gamertag live check --
  const checkGamertagAvailability = useCallback(async (tag: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGamertagStatus("checking");
    try {
      const res = await fetch("/api/user/gamertag/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamertag: tag }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = await res.json();
      if (data.available) setGamertagStatus("available");
      else setGamertagStatus(data.reason ? "invalid" : "taken");
    } catch {
      if (!controller.signal.aborted) setGamertagStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (editingField !== "gamertag") return;
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    setFieldError(null);

    const val = editValue.trim();
    if (!val) { setGamertagStatus("idle"); return; }

    // Same as current — no need to check
    if (val.toLowerCase() === gamertag?.toLowerCase()) { setGamertagStatus("available"); return; }

    if (!GAMERTAG_REGEX.test(val)) {
      setGamertagStatus("invalid");
      setFieldError("3–20 characters: letters, numbers, underscores, or hyphens.");
      return;
    }

    checkTimerRef.current = setTimeout(() => checkGamertagAvailability(val), 400);
    return () => { if (checkTimerRef.current) clearTimeout(checkTimerRef.current); };
  }, [editValue, editingField, gamertag, checkGamertagAvailability]);

  // -- Start editing --
  const startEdit = (field: "name" | "email" | "gamertag") => {
    setFieldError(null);
    setFieldSuccess(null);
    setGamertagStatus("idle");
    setEditingField(field);
    if (field === "name") setEditValue(user?.displayName || "");
    else if (field === "email") setEditValue(user?.email || "");
    else if (field === "gamertag") setEditValue(gamertag || "");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
    setFieldError(null);
    setGamertagStatus("idle");
  };

  // -- Save handlers --
  const saveName = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) { setFieldError("Name cannot be empty."); return; }
    setFieldSaving(true);
    setFieldError(null);
    try {
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (res.ok) {
        await currentUser.reload();
        setEditingField(null);
        setFieldSuccess("Name updated.");
        setTimeout(() => setFieldSuccess(null), 3000);
      } else {
        const data = await res.json();
        setFieldError(data.error || "Failed to save.");
      }
    } catch {
      setFieldError("Something went wrong.");
    } finally {
      setFieldSaving(false);
    }
  };

  const saveEmail = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) { setFieldError("Email cannot be empty."); return; }
    setFieldSaving(true);
    setFieldError(null);
    try {
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const { verifyBeforeUpdateEmail } = await import("firebase/auth");
      await verifyBeforeUpdateEmail(currentUser, trimmed);
      setEditingField(null);
      setFieldSuccess("Verification email sent to " + trimmed + ". Check your inbox.");
      setTimeout(() => setFieldSuccess(null), 8000);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/requires-recent-login") {
        setFieldError("Please sign out and sign back in before changing your email.");
      } else if (code === "auth/invalid-email") {
        setFieldError("Invalid email address.");
      } else {
        setFieldError("Failed to send verification email.");
      }
    } finally {
      setFieldSaving(false);
    }
  };

  const saveGamertag = async () => {
    if (gamertagStatus !== "available" || !editValue.trim()) return;
    setFieldSaving(true);
    setFieldError(null);
    try {
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/user/gamertag", {
        method: "PUT",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ gamertag: editValue.trim() }),
      });
      if (res.ok) {
        await refreshUserData();
        setEditingField(null);
        setFieldSuccess("Gamertag updated.");
        setTimeout(() => setFieldSuccess(null), 3000);
      } else {
        const data = await res.json();
        setFieldError(data.error || "Failed to save.");
        if (res.status === 409) setGamertagStatus("taken");
      }
    } catch {
      setFieldError("Something went wrong.");
    } finally {
      setFieldSaving(false);
    }
  };

  const handleSave = () => {
    if (editingField === "name") saveName();
    else if (editingField === "email") saveEmail();
    else if (editingField === "gamertag") saveGamertag();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: theme.surfaces.base }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: theme.accents.neonPink, borderTopColor: "transparent" }}
          />
          <p className="font-mono text-sm" style={{ color: theme.text.secondary }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/auth";
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: theme.surfaces.base }}>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: theme.accents.neonPink, borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const displayName = user.displayName || "User";
  const email = user.email || "No email";
  const levelTitle = levelData?.title ?? `Level ${level}`;
  const levelIconSrc = getLevelIconURL(levelData);

  const canSave =
    editingField === "gamertag"
      ? gamertagStatus === "available" && !fieldSaving
      : editValue.trim().length > 0 && !fieldSaving;

  const gamertagStatusIcon = (() => {
    if (editingField !== "gamertag") return null;
    switch (gamertagStatus) {
      case "checking": return <Loader2 size={16} className="animate-spin text-white/40" />;
      case "available": return <Check size={16} className="text-emerald-400" />;
      case "taken": return <X size={16} className="text-red-400" />;
      case "invalid": return <X size={16} className="text-amber-400" />;
      default: return null;
    }
  })();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <JMAppHeader />

      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: "url('/images/bgs/BG-Signup.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <main className="relative z-10 mx-auto flex max-w-md flex-col px-6 py-12">
        {/* Success toast */}
        {fieldSuccess && (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm font-medium text-center"
            style={{ backgroundColor: `${theme.semantic.success ?? "#22c55e"}20`, color: theme.semantic.success ?? "#22c55e" }}
          >
            {fieldSuccess}
          </div>
        )}

        <div
          className="opacity-0 animate-fade-in-up animation-delay-200 rounded-2xl border overflow-hidden backdrop-blur-md"
          style={{ backgroundColor: `${theme.surfaces.base}ee`, borderColor: theme.surfaces.elevated2 }}
        >
          {/* ── Header: Level icon + info (left) / Gamertag (right) ── */}
          <div
            className="flex items-center justify-between px-8 pt-8 pb-4"
          >
            {/* Left: Level icon, level #, points */}
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-xl overflow-hidden" style={{ width: 72, height: 72, backgroundColor: theme.surfaces.elevated1 }}>
                {levelIconSrc ? (
                  <Image
                    src={levelIconSrc}
                    alt={levelTitle}
                    width={72}
                    height={72}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Trophy size={32} style={{ color: theme.accents.goldenGlow }} />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: theme.accents.goldenGlow }}>
                  {levelTitle}
                </p>
                <p className="font-mono text-xs" style={{ color: theme.text.tertiary }}>
                  Level {level}
                </p>
              </div>
            </div>

            {/* Right: Gamertag */}
            <div className="text-right">
              <p
                className="text-2xl font-black tracking-tight"
                style={{ color: theme.text.primary }}
              >
                {gamertag || "—"}
              </p>
              {isAdmin && (
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: theme.accents.goldenGlow }}>
                  <ShieldUser size={12} />
                  Admin
                </span>
              )}
            </div>
          </div>

          <div className="p-8 pt-6 space-y-6">
            {/* Avatar — larger */}
            <div className="flex flex-col items-center">
              <JMAvatarPreviewAndSelection
                selectedAvatar={avatarName}
                onAvatarSelect={handleAvatarSelect}
                onAvatarRemove={handleAvatarRemove}
                isLoading={avatarLoading || avatarSaving}
                size={200}
                showChangeButton
              />
              {avatarSaving && (
                <p className="mt-2 text-xs" style={{ color: theme.text.tertiary }}>Saving...</p>
              )}
            </div>

            {/* Gamertag */}
            <EditableField
              icon={<Gamepad2 size={14} />}
              label="Gamertag"
              value={gamertag || "Not set"}
              isEditing={editingField === "gamertag"}
              editValue={editValue}
              onEditValueChange={(v) => setEditValue(v.replace(/\s/g, ""))}
              onStartEdit={() => startEdit("gamertag")}
              onSave={handleSave}
              onCancel={cancelEdit}
              canSave={canSave}
              isSaving={fieldSaving}
              error={editingField === "gamertag" ? fieldError : null}
              placeholder="e.g. ShadowKnight"
              theme={theme}
              statusIcon={gamertagStatusIcon}
              statusMessage={
                editingField === "gamertag" && gamertagStatus === "available" ? "Available!" :
                editingField === "gamertag" && gamertagStatus === "taken" ? "Already taken." :
                null
              }
              statusColor={
                gamertagStatus === "available" ? "#34d399" :
                gamertagStatus === "taken" ? "#f87171" :
                undefined
              }
              maxLength={20}
              valueColor={gamertag ? theme.text.primary : theme.text.tertiary}
              disableAutoFormat
            />

            {/* Name */}
            <EditableField
              icon={<User size={14} />}
              label="Name"
              value={displayName}
              isEditing={editingField === "name"}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onStartEdit={() => startEdit("name")}
              onSave={handleSave}
              onCancel={cancelEdit}
              canSave={canSave}
              isSaving={fieldSaving}
              error={editingField === "name" ? fieldError : null}
              placeholder="Your name"
              theme={theme}
            />

            {/* Email */}
            <EditableField
              icon={<Mail size={14} />}
              label="Email"
              value={email}
              isEditing={editingField === "email"}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onStartEdit={() => startEdit("email")}
              onSave={handleSave}
              onCancel={cancelEdit}
              canSave={canSave}
              isSaving={fieldSaving}
              error={editingField === "email" ? fieldError : null}
              placeholder="you@example.com"
              theme={theme}
              inputType="email"
              disableAutoFormat
            />

            {/* Role (non-admin only — admins see badge in header) */}
            {!isAdmin && (
              <div>
                <label
                  className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
                  style={{ color: theme.text.tertiary }}
                >
                  <ShieldUser size={14} />
                  Role
                </label>
                <div
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: theme.surfaces.elevated2, backgroundColor: theme.surfaces.elevated1 }}
                >
                  <span style={{ color: theme.text.secondary }}>Member</span>
                </div>
              </div>
            )}

            {/* Points + Progress */}
            {(() => {
              const currentPoints = points;
              const currentLevelMin = levelData?.minPoints ?? 0;
              const nextLevelMin = nextLevelData?.minPoints ?? currentLevelMin;
              const range = nextLevelMin - currentLevelMin;
              const progress = range > 0 ? Math.min((currentPoints - currentLevelMin) / range, 1) : (nextLevelData ? 0 : 1);

              return (
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: theme.surfaces.elevated2, backgroundColor: theme.surfaces.elevated1 }}
                >
                  {/* Progress bar */}
                  <div className="mx-4 mt-4 rounded-full overflow-hidden" style={{ height: 7, backgroundColor: "#4a1520" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(progress * 100, 0)}%`, backgroundColor: "#22c55e" }}
                    />
                  </div>

                  <div className="px-4 py-4 flex items-center gap-4">
                    <Trophy size={44} className="shrink-0" style={{ color: theme.accents.goldenGlow }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: theme.text.primary }}>
                        Current Points: {currentPoints.toLocaleString()}
                      </p>
                      {nextLevelData ? (
                        <p className="text-xs mt-0.5" style={{ color: theme.text.tertiary }}>
                          Next Level: {nextLevelData.title} — {nextLevelData.minPoints.toLocaleString()} points
                        </p>
                      ) : (
                        <p className="text-xs mt-0.5" style={{ color: theme.accents.goldenGlow }}>
                          Max level reached!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sign out */}
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

/* ── Inline editable field component ── */

interface EditableFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isEditing: boolean;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
  isSaving: boolean;
  error: string | null;
  placeholder?: string;
  theme: JMTheme;
  inputType?: string;
  statusIcon?: React.ReactNode;
  statusMessage?: string | null;
  statusColor?: string | undefined;
  maxLength?: number;
  valueColor?: string | undefined;
  /** Disable iOS auto-capitalization / autocorrect for fields like gamertag/email. */
  disableAutoFormat?: boolean;
}

function EditableField({
  icon,
  label,
  value,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSave,
  onCancel,
  canSave,
  isSaving,
  error,
  placeholder,
  theme,
  inputType = "text",
  statusIcon,
  statusMessage,
  statusColor,
  maxLength,
  valueColor,
  disableAutoFormat,
}: EditableFieldProps) {
  const t = theme;

  if (isEditing) {
    return (
      <div>
        <label className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider" style={{ color: t.text.tertiary }}>
          {icon}
          {label}
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={inputType}
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              autoFocus
              {...(disableAutoFormat
                ? {
                    autoCapitalize: "off",
                    autoCorrect: "off",
                    spellCheck: false,
                    autoComplete: "off",
                  }
                : {})}
              className="w-full rounded-xl border px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-1"
              style={{
                borderColor: t.surfaces.elevated2,
                backgroundColor: t.surfaces.elevated1,
                color: t.text.primary,
                // @ts-expect-error CSS custom property
                "--tw-ring-color": t.accents.neonPink,
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && canSave) onSave(); if (e.key === "Escape") onCancel(); }}
            />
            {statusIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2">{statusIcon}</span>}
          </div>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="shrink-0 rounded-lg p-2.5 transition-colors disabled:opacity-30"
            style={{ backgroundColor: `${t.accents.neonPink}20`, color: t.accents.neonPink }}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
          <button
            onClick={onCancel}
            className="shrink-0 rounded-lg p-2.5 transition-colors"
            style={{ backgroundColor: `${t.text.tertiary}15`, color: t.text.tertiary }}
          >
            <X size={16} />
          </button>
        </div>
        {statusMessage && (
          <p className="mt-1.5 text-xs font-medium" style={{ color: statusColor }}>{statusMessage}</p>
        )}
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider" style={{ color: t.text.tertiary }}>
        {icon}
        {label}
      </label>
      <div
        className="group relative rounded-xl border px-4 py-3 cursor-pointer transition-colors hover:border-white/20"
        style={{ borderColor: t.surfaces.elevated2, backgroundColor: t.surfaces.elevated1, color: valueColor || t.text.primary }}
        onClick={onStartEdit}
      >
        {value}
        <Pencil
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-60"
          style={{ color: t.text.tertiary }}
        />
      </div>
    </div>
  );
}
