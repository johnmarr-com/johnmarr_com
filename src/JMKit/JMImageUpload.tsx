"use client";

import { useState, useRef, useCallback } from "react";
import NextImage from "next/image";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export interface JMImageUploadProps {
  /** Current image URL (if already uploaded) */
  value?: string;
  /** Called when image is uploaded or removed */
  onChange: (url: string | null) => void;
  /** Aspect ratio: "square" (1:1), "wide" (2:1), or "landscape" (16:9) */
  aspectRatio?: "square" | "wide" | "landscape";
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
  /** Max width for uploaded image (resizes before upload). Default: no resize */
  maxWidth?: number;
}

/**
 * Resize an image file using Canvas API
 * Maintains aspect ratio, only shrinks (never enlarges)
 */
async function resizeImage(file: File, maxWidth: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Don't upscale - only downscale
      if (img.width <= maxWidth) {
        resolve(file);
        return;
      }

      const ratio = maxWidth / img.width;
      const newWidth = maxWidth;
      const newHeight = Math.round(img.height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not create blob"));
            return;
          }
          // Create new file with same name but resized content
          const resizedFile = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        "image/jpeg",
        0.9 // 90% quality - good balance of size/quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * JMImageUpload - Image upload component with drag-and-drop
 * 
 * Features:
 * - Drag and drop support
 * - Click to select file
 * - Image preview
 * - Aspect ratio enforcement (visual only)
 * - Loading state during upload
 * - Remove button
 * - Optional image resizing before upload
 */
export function JMImageUpload({
  value,
  onChange,
  aspectRatio = "square",
  onUpload,
  label,
  required = false,
  disabled = false,
  previewSize = 150,
  maxWidth,
}: JMImageUploadProps) {
  const { theme } = useJMStyle();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate dimensions based on aspect ratio
  const width = previewSize;
  const height = aspectRatio === "square" 
    ? previewSize 
    : aspectRatio === "wide" 
      ? Math.round(previewSize / 2)  // 2:1
      : Math.round(previewSize * 9 / 16);  // 16:9

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB before resize)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Resize if maxWidth is set
      let fileToUpload = file;
      if (maxWidth) {
        fileToUpload = await resizeImage(file, maxWidth);
      }

      const url = await onUpload(fileToUpload);
      onChange(url);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, onChange, maxWidth]);

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
    if (!disabled && !isUploading) {
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
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-opacity-100"}
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
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {/* Content */}
        {value ? (
          // Image preview
          <>
            <NextImage
              src={value}
              alt="Preview"
              fill
              className="object-cover"
            />
            {/* Remove button */}
            {!disabled && !isUploading && (
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black transition-colors"
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
              {maxWidth ? "Resizing & uploading..." : "Uploading..."}
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
              <ImageIcon 
                size={32} 
                className="mb-2"
                style={{ color: theme.text.tertiary }}
              />
            )}
            <span 
              className="text-xs text-center"
              style={{ color: isDragging ? theme.accents.goldenGlow : theme.text.tertiary }}
            >
              {isDragging ? "Drop image" : "Click or drag image"}
            </span>
            <span 
              className="text-xs mt-1"
              style={{ color: theme.text.tertiary }}
            >
              {aspectRatio === "square" ? "1:1" : aspectRatio === "wide" ? "2:1 (640×320)" : "16:9"} • Max 5MB
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
