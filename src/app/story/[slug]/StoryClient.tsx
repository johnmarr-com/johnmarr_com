"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BookOpen, Download, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { JMEpubReader } from "@/JMKit/JMEpubReader";
import {
  getStorySettings,
  updateStorySettings,
  getReadingProgress,
  updateReadingProgress,
} from "@/lib/stories";
import type { JMStorySettings } from "@/lib/content-types";
import type { StoryPageData } from "@/lib/detail-server";
import { SignupGateModal } from "@/components/SignupGateModal";
import { Activity } from "@/lib/points";

export default function StoryClient({ story }: { story: StoryPageData }) {
  const router = useRouter();
  const { user } = useAuth();

  const [settings, setSettings] = useState<JMStorySettings>({ fontSize: 18, darkMode: true });
  const [savedLocation, setSavedLocation] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  // Soft email gate: anonymous readers get the full free taste; the prompt
  // appears when they close the reader (save your place) or try to download.
  const [gateOpen, setGateOpen] = useState(false);
  const [gateShown, setGateShown] = useState(false);

  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Per-user reading prefs + saved position (signed-in only).
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    Promise.all([
      getStorySettings(user.uid),
      getReadingProgress(user.uid, story.id),
    ])
      .then(([userSettings, progress]) => {
        if (cancelled) return;
        setSettings(userSettings);
        if (progress?.location) setSavedLocation(progress.location);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [user?.uid, story.id]);

  const uid = user?.uid;

  const handleSettingsChange = useCallback((newSettings: Partial<JMStorySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (uid) {
        updateStorySettings(uid, newSettings).catch(console.error);
      }
      return updated;
    });
  }, [uid]);

  const handleLocationChange = useCallback((cfi: string) => {
    if (!uid) return;
    setSavedLocation(cfi);

    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    progressTimeoutRef.current = setTimeout(() => {
      updateReadingProgress(uid, story.id, cfi).catch(console.error);
    }, 1500);
  }, [uid, story.id]);

  const handleClose = useCallback(() => {
    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    setIsReading(false);
    // Anonymous reader closing the book: one friendly invite to keep their place.
    if (!user && !gateShown) {
      setGateShown(true);
      setGateOpen(true);
    }
  }, [user, gateShown]);

  const handleDownload = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (user) return; // signed-in: normal download
    e.preventDefault();
    setGateShown(true);
    setGateOpen(true);
  }, [user]);

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    };
  }, []);

  if (isReading && story.epubURL) {
    return (
      <JMEpubReader
        title={story.title}
        epubURL={story.epubURL}
        initialLocation={savedLocation || undefined}
        settings={settings}

        onSettingsChange={handleSettingsChange}
        onLocationChange={handleLocationChange}
        onClose={handleClose}
        pointsActivity={Activity.READ_STORY}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f0f0f]">
      <div className="min-h-full flex flex-col items-center px-6 py-12">
        {/* Back button */}
        <div className="w-full max-w-md mb-8">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        {/* Cover */}
        {story.coverImageURL && (
          <div className="w-48 sm:w-56 md:w-64 aspect-3/4 mb-8">
            <Image
              src={story.coverImageURL}
              alt={story.title}
              width={256}
              height={341}
              priority
              className="w-full h-full object-cover"
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
            />
          </div>
        )}

        {/* Title & Author */}
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-white mb-1">
          {story.title}
        </h1>
        {story.subtitle && (
          <p className="text-base text-white/40 text-center mb-2 italic">{story.subtitle}</p>
        )}
        <p className="text-sm text-white/50 text-center mb-6">by {story.author}</p>

        {/* Description */}
        {story.description && (
          <p className="text-sm text-white/60 text-center max-w-md leading-relaxed mb-8">
            {story.description}
          </p>
        )}

        {/* Continue reading prompt */}
        {savedLocation && (
          <p className="text-xs text-white/30 mb-4">You have saved progress in this book.</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4">
          {story.epubURL ? (
            <>
              <button
                onClick={() => setIsReading(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ backgroundColor: "#e8c547", color: "#0f0f0f" }}
              >
                <BookOpen size={18} />
                {savedLocation ? "Continue Reading" : "Read"}
              </button>
              <a
                href={story.epubURL}
                download
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <Download size={18} />
                Download EPUB
              </a>
            </>
          ) : (
            <p className="text-sm text-white/40">This story is not yet available for reading.</p>
          )}
        </div>
      </div>

      {/* Soft signup gate for anonymous readers */}
      {gateOpen && (
        <SignupGateModal
          title={`Enjoying ${story.title}?`}
          message="Create a free account to save your place, download the book, and get new stories as they drop."
          redirect={`/story/${story.slug}`}
          source="story_gate"
          onClose={() => setGateOpen(false)}
        />
      )}
    </div>
  );
}
