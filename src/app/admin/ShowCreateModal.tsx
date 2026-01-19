"use client";

import { useState, useCallback, useRef } from "react";
import { X, Film, Tv, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { JMImageUpload } from "@/JMKit";
import { useAuth } from "@/lib/AuthProvider";
import { createContent, uploadContentImage } from "@/lib/content";
import type { JMContentLevel, JMReleaseDay } from "@/lib/content-types";
import { JMReleaseDayLabels } from "@/lib/content-types";

interface ShowCreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type Step = "type" | "details";

/**
 * ShowCreateModal - Multi-step modal for creating a new show
 * 
 * Step 1: Choose type (Series or Movie)
 * Step 2: Enter details (name, description)
 * 
 * Future: Cover image upload
 */
export function ShowCreateModal({ onClose, onCreated }: ShowCreateModalProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  
  // Step state
  const [step, setStep] = useState<Step>("type");
  
  // Form state
  const [contentLevel, setContentLevel] = useState<JMContentLevel | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverURL, setCoverURL] = useState("");      // Cover (16:9)
  const [backdropURL, setBackdropURL] = useState(""); // Feature/Banner (16:9)
  const [releaseDay, setReleaseDay] = useState<JMReleaseDay | "">("");  // Optional release day
  
  // Temp ID for image uploads (before content is created)
  const tempIdRef = useRef(`new-${Date.now()}`);
  
  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle image uploads
  const handleIconUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, tempIdRef.current, "cover");
  }, []);

  const handleBannerUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, tempIdRef.current, "backdrop");
  }, []);

  const handleTypeSelect = (level: JMContentLevel) => {
    setContentLevel(level);
    setStep("details");
  };

  const handleBack = () => {
    setStep("type");
    setError(null);
  };

  const handleCreate = async () => {
    if (!user || !contentLevel || !name.trim()) return;
    
    setIsCreating(true);
    setError(null);
    
    try {
      const input: Parameters<typeof createContent>[0] = {
        contentType: "show",
        contentLevel,
        name: name.trim(),
        description: description.trim(),
        coverURL: coverURL.trim() || "",
        isPublished: false,
      };
      if (backdropURL.trim()) input.backdropURL = backdropURL.trim();
      if (releaseDay) input.releaseDay = releaseDay;
      
      await createContent(input, user.uid);
      
      onCreated();
    } catch (err) {
      console.error("Failed to create show:", err);
      setError(err instanceof Error ? err.message : "Failed to create show");
    } finally {
      setIsCreating(false);
    }
  };

  const canCreate = name.trim().length > 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop - clicking does NOT close (only X button closes) */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-lg rounded-2xl border-2 overflow-hidden"
        style={{ 
          backgroundColor: "rgba(20, 20, 20, 1)",
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
        >
          <h2 
            className="text-lg font-semibold"
            style={{ color: theme.text.primary }}
          >
            {step === "type" ? "New Show" : contentLevel === "standalone" ? "New Movie" : "New Series"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: theme.text.secondary }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "type" ? (
            // Step 1: Type selection
            <div className="space-y-4">
              <p 
                className="text-sm mb-6"
                style={{ color: theme.text.secondary }}
              >
                What type of show are you creating?
              </p>
              
              {/* Series option */}
              <button
                onClick={() => handleTypeSelect("series")}
                className="w-full p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] hover:border-opacity-100 group"
                style={{ 
                  borderColor: `${theme.accents.goldenGlow}40`,
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${theme.accents.goldenGlow}20` }}
                  >
                    <Tv size={24} style={{ color: theme.accents.goldenGlow }} />
                  </div>
                  <div className="flex-1">
                    <div 
                      className="font-semibold mb-1"
                      style={{ color: theme.text.primary }}
                    >
                      Series
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: theme.text.tertiary }}
                    >
                      Multiple episodes, optionally organized into seasons. Perfect for TV shows, limited series, or episodic content.
                    </div>
                  </div>
                  <ArrowRight 
                    size={20} 
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: theme.accents.goldenGlow }}
                  />
                </div>
              </button>

              {/* Movie option */}
              <button
                onClick={() => handleTypeSelect("standalone")}
                className="w-full p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] hover:border-opacity-100 group"
                style={{ 
                  borderColor: `${theme.accents.neonPink}40`,
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${theme.accents.neonPink}20` }}
                  >
                    <Film size={24} style={{ color: theme.accents.neonPink }} />
                  </div>
                  <div className="flex-1">
                    <div 
                      className="font-semibold mb-1"
                      style={{ color: theme.text.primary }}
                    >
                      Movie / Special
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: theme.text.tertiary }}
                    >
                      Single video that plays directly. Perfect for films, documentaries, or one-off specials.
                    </div>
                  </div>
                  <ArrowRight 
                    size={20} 
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: theme.accents.neonPink }}
                  />
                </div>
              </button>
            </div>
          ) : (
            // Step 2: Details
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.text.secondary }}
                >
                  Name <span style={{ color: theme.semantic.error }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={contentLevel === "standalone" ? "Enter movie title..." : "Enter series title..."}
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.text.secondary }}
                >
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the show..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
              </div>

              {/* Release Day - only for series */}
              {contentLevel === "series" && (
                <div>
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: theme.text.secondary }}
                  >
                    New Episodes Day <span style={{ color: theme.text.tertiary }}>(optional)</span>
                  </label>
                  <select
                    value={releaseDay}
                    onChange={(e) => setReleaseDay(e.target.value as JMReleaseDay | "")}
                    className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      color: releaseDay ? theme.text.primary : theme.text.tertiary,
                      // @ts-expect-error CSS custom property
                      "--tw-ring-color": theme.accents.goldenGlow,
                    }}
                  >
                    <option value="">No recurring day</option>
                    {(Object.keys(JMReleaseDayLabels) as JMReleaseDay[]).map((day) => (
                      <option key={day} value={day}>
                        {JMReleaseDayLabels[day]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cover & Banner Images */}
              <div className="flex flex-col gap-4">
                <JMImageUpload
                  label="Cover (2:1)"
                  value={coverURL}
                  onChange={(url) => setCoverURL(url || "")}
                  onUpload={handleIconUpload}
                  aspectRatio="wide"
                  previewSize={200}
                  maxWidth={640}
                  required
                />
                <JMImageUpload
                  label="Banner (16:9)"
                  value={backdropURL}
                  onChange={(url) => setBackdropURL(url || "")}
                  onUpload={handleBannerUpload}
                  aspectRatio="landscape"
                  previewSize={200}
                  maxWidth={1920}
                />
              </div>

              {/* Error message */}
              {error && (
                <div 
                  className="text-sm px-4 py-2 rounded-lg"
                  style={{ 
                    backgroundColor: `${theme.semantic.error}20`,
                    color: theme.semantic.error,
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "details" && (
          <div 
            className="flex items-center justify-between px-6 py-4 border-t"
            style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
          >
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
              style={{ color: theme.text.secondary }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            
            <button
              onClick={handleCreate}
              disabled={!canCreate || isCreating}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100"
              style={{
                backgroundColor: theme.accents.goldenGlow,
                color: theme.surfaces.base,
              }}
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Create {contentLevel === "standalone" ? "Movie" : "Series"}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
