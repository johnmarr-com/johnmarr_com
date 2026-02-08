"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Video, Loader2, Play } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export interface JMVideoUploadProps {
  /** Current video URL (if already uploaded) */
  value?: string;
  /** Called when video is uploaded or removed */
  onChange: (url: string | null) => void;
  /** Upload function - receives file, returns URL */
  onUpload: (file: File) => Promise<string>;
  /** Label shown above the upload area */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Size of the preview (width in pixels) */
  previewSize?: number;
  /** Max file size in MB (default: 10MB) */
  maxSizeMB?: number;
}

/**
 * JMVideoUpload - Short video upload component with drag-and-drop
 * 
 * Features:
 * - Drag and drop support
 * - Click to select file
 * - Video preview with play button
 * - Loading state during upload
 * - Remove button
 * - Supports mp4 and webm formats
 * - Max 15 second videos (for album covers)
 */
export function JMVideoUpload({
  value,
  onChange,
  onUpload,
  label,
  required = false,
  disabled = false,
  previewSize = 150,
  maxSizeMB = 10,
}: JMVideoUploadProps) {
  const { theme } = useJMStyle();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Square preview for album covers
  const width = previewSize;
  const height = previewSize;

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file (mp4 or webm)");
      return;
    }

    // Validate specific formats
    if (!["video/mp4", "video/webm"].includes(file.type)) {
      setError("Only MP4 and WebM formats are supported");
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Video must be less than ${maxSizeMB}MB`);
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
    onChange(null);
    setError(null);
    setIsPlaying(false);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
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

      {/* Upload area */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative overflow-hidden rounded-xl border-2 border-dashed cursor-pointer
          transition-all duration-200
          ${isDragging ? "scale-[1.02]" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : value ? "" : "hover:border-opacity-100"}
        `}
        style={{
          width,
          height,
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
          accept="video/mp4,video/webm"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {/* Content */}
        {value ? (
          // Video preview
          <>
            <video
              ref={videoRef}
              src={value}
              className="absolute inset-0 w-full h-full object-cover"
              loop
              muted
              playsInline
              onEnded={() => setIsPlaying(false)}
            />
            {/* Play/Pause overlay */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              >
                <div 
                  className="p-3 rounded-full"
                  style={{ backgroundColor: `${theme.accents.goldenGlow}90` }}
                >
                  <Play size={24} fill="white" style={{ color: "white" }} />
                </div>
              </button>
            )}
            {isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0"
              />
            )}
            {/* Remove button */}
            {!disabled && !isUploading && (
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black transition-colors z-10"
                style={{ color: theme.text.primary }}
              >
                <X size={14} />
              </button>
            )}
          </>
        ) : isUploading ? (
          // Loading state
          <div className="absolute inset-0 flex flex-col items-center justify-center">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {isDragging ? (
              <Upload 
                size={32} 
                className="mb-2"
                style={{ color: theme.accents.goldenGlow }}
              />
            ) : (
              <Video 
                size={32} 
                className="mb-2"
                style={{ color: theme.text.tertiary }}
              />
            )}
            <span 
              className="text-xs text-center"
              style={{ color: isDragging ? theme.accents.goldenGlow : theme.text.tertiary }}
            >
              {isDragging ? "Drop video" : "Click or drag video"}
            </span>
            <span 
              className="text-xs mt-1"
              style={{ color: theme.text.tertiary }}
            >
              MP4/WebM • Max {maxSizeMB}MB
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
