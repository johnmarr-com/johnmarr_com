"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookOpen, Download, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { JMEpubReader } from "@/JMKit/JMEpubReader";
import {
  getStoryBySlug,
  getStorySettings,
  updateStorySettings,
  getReadingProgress,
  updateReadingProgress,
} from "@/lib/stories";
import type { JMStory, JMStorySettings } from "@/lib/content-types";

export default function StoryPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const rawSlug = params["slug"];
  const slug = typeof rawSlug === "string" ? rawSlug : "";

  const [story, setStory] = useState<JMStory | null>(null);
  const [settings, setSettings] = useState<JMStorySettings>({ fontSize: 18, darkMode: true });
  const [savedLocation, setSavedLocation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const storyData = await getStoryBySlug(slug);
        if (!storyData) {
          setError("Story not found");
          setIsLoading(false);
          return;
        }

        setStory(storyData);

        if (user?.uid) {
          const [userSettings, progress] = await Promise.all([
            getStorySettings(user.uid),
            getReadingProgress(user.uid, storyData.id),
          ]);
          setSettings(userSettings);
          if (progress?.location) {
            setSavedLocation(progress.location);
          }
        }
      } catch (err) {
        console.error("Failed to load story:", err);
        setError(err instanceof Error ? err.message : "Failed to load story");
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      load();
    }
  }, [slug, user?.uid, authLoading]);

  const handleSettingsChange = useCallback((newSettings: Partial<JMStorySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (user?.uid) {
        updateStorySettings(user.uid, newSettings).catch(console.error);
      }
      return updated;
    });
  }, [user?.uid]);

  const handleLocationChange = useCallback((cfi: string) => {
    if (!user?.uid || !story?.id) return;
    setSavedLocation(cfi);

    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    progressTimeoutRef.current = setTimeout(() => {
      updateReadingProgress(user.uid, story.id, cfi).catch(console.error);
    }, 1500);
  }, [user?.uid, story?.id]);

  const handleClose = useCallback(() => {
    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    setIsReading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    };
  }, []);

  if (isLoading || authLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f0f0f]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0f0f] text-center px-6">
        <p className="text-lg font-medium text-white/80 mb-4">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
        >
          Go Home
        </button>
      </div>
    );
  }

  if (!story) return null;

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
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f0f0f]">
      <div className="min-h-full flex flex-col items-center px-6 py-12">
        {/* Back button */}
        <div className="w-full max-w-md mb-8">
          <button
            onClick={() => router.push("/")}
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
            <img
              src={story.coverImageURL}
              alt={story.title}
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
    </div>
  );
}
