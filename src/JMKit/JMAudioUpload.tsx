"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Music, Loader2, Play, Pause } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export interface JMAudioUploadProps {
  /** Current audio URL (if already uploaded) */
  value?: string;
  /** Called when audio is uploaded or removed */
  onChange: (url: string | null) => void;
  /** Upload function - receives file, returns URL */
  onUpload: (file: File) => Promise<string>;
  /** Called when duration is detected from uploaded file */
  onDurationDetected?: (duration: number) => void;
  /** Label shown above the upload area */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Max file size in MB (default: 20MB) */
  maxSizeMB?: number;
}

/**
 * Format seconds as mm:ss
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * JMAudioUpload - Audio file upload component with inline player
 * 
 * Features:
 * - Drag and drop support
 * - Click to select file
 * - Inline audio player preview
 * - Duration detection
 * - Loading state during upload
 * - Remove button
 * - Supports mp3, m4a, wav, ogg formats
 */
export function JMAudioUpload({
  value,
  onChange,
  onUpload,
  onDurationDetected,
  label,
  required = false,
  disabled = false,
  maxSizeMB = 20,
}: JMAudioUploadProps) {
  const { theme } = useJMStyle();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Update current time during playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      if (onDurationDetected) {
        onDurationDetected(Math.round(audio.duration));
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [value, onDurationDetected]);

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file");
      return;
    }

    // Validate specific formats
    const validTypes = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/ogg"];
    if (!validTypes.some(t => file.type.includes(t.split("/")[1] || ""))) {
      setError("Supported formats: MP3, M4A, WAV, OGG");
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Audio must be less than ${maxSizeMB}MB`);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const url = await onUpload(file);
      onChange(url);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, onChange, maxSizeMB]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled || isUploading) return;
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [disabled, isUploading, handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    if (!disabled && !isUploading && !value) {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onChange(null);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * duration;
  };

  return (
    <div>
      {/* Label */}
      {label && (
        <label 
          className="block text-sm font-medium mb-2"
          style={{ color: theme.text.secondary }}
        >
          {label}
          {required && <span style={{ color: theme.semantic.error }}> *</span>}
        </label>
      )}

      {/* Upload area / Player */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative overflow-hidden rounded-xl border-2 
          transition-all duration-200
          ${value ? "border-solid" : "border-dashed cursor-pointer"}
          ${isDragging ? "scale-[1.02]" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : value ? "" : "hover:border-opacity-100"}
        `}
        style={{
          borderColor: isDragging 
            ? theme.accents.goldenGlow 
            : error 
              ? theme.semantic.error 
              : "rgba(255, 255, 255, 0.3)",
          backgroundColor: isDragging 
            ? `${theme.accents.goldenGlow}10` 
            : "rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/ogg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {/* Hidden audio element */}
        {value && (
          <audio ref={audioRef} src={value} preload="metadata" />
        )}

        {/* Content */}
        {value ? (
          // Audio player
          <div className="p-4">
            <div className="flex items-center gap-3">
              {/* Play/Pause button */}
              <button
                onClick={togglePlay}
                className="shrink-0 p-2.5 rounded-full transition-colors"
                style={{ 
                  backgroundColor: `${theme.accents.goldenGlow}20`,
                  color: theme.accents.goldenGlow,
                }}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              {/* Progress bar and time */}
              <div className="flex-1 min-w-0">
                {/* Progress bar */}
                <div 
                  className="h-2 rounded-full cursor-pointer mb-1"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                  onClick={handleSeek}
                >
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      backgroundColor: theme.accents.goldenGlow,
                    }}
                  />
                </div>

                {/* Time display */}
                <div className="flex justify-between text-xs" style={{ color: theme.text.tertiary }}>
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Remove button */}
              {!disabled && !isUploading && (
                <button
                  onClick={handleRemove}
                  className="shrink-0 p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  style={{ color: theme.text.tertiary }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        ) : isUploading ? (
          // Loading state
          <div className="p-6 flex flex-col items-center justify-center">
            <Loader2 
              size={32} 
              className="animate-spin mb-2"
              style={{ color: theme.accents.goldenGlow }}
            />
            <span 
              className="text-xs"
              style={{ color: theme.text.tertiary }}
            >
              Uploading...
            </span>
          </div>
        ) : (
          // Empty state
          <div className="p-6 flex flex-col items-center justify-center">
            {isDragging ? (
              <Upload 
                size={32} 
                className="mb-2"
                style={{ color: theme.accents.goldenGlow }}
              />
            ) : (
              <Music 
                size={32} 
                className="mb-2"
                style={{ color: theme.text.tertiary }}
              />
            )}
            <span 
              className="text-xs text-center"
              style={{ color: isDragging ? theme.accents.goldenGlow : theme.text.tertiary }}
            >
              {isDragging ? "Drop audio file" : "Click or drag audio file"}
            </span>
            <span 
              className="text-xs mt-1"
              style={{ color: theme.text.tertiary }}
            >
              MP3, M4A, WAV • Max {maxSizeMB}MB
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p 
          className="mt-2 text-xs"
          style={{ color: theme.semantic.error }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
