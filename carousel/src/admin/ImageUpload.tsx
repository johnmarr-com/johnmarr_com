"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
} from "react";

import { mergeTheme, type CarouselTheme } from "../theme";

export interface ImageUploadProps {
  /** Current image URL, if any. */
  value?: string;
  /** Fires with the new URL, or null when cleared. */
  onChange: (url: string | null) => void;
  /** Performs the upload and resolves to a public URL. */
  onUpload: (file: File) => Promise<string>;
  label?: string;
  /** Preview box aspect. Banners are "landscape" (16:9). */
  aspectRatio?: "landscape" | "square" | "wide" | "portrait";
  /** Preview width in px. Default 300. */
  previewSize?: number;
  /** Downscale (never upscale) to this width before uploading. */
  maxWidth?: number;
  disabled?: boolean;
  theme?: Partial<CarouselTheme>;
}

/**
 * Downscale a picked file through a canvas before it is uploaded.
 * A 4000px hero is indistinguishable from a 1920px one on screen and costs
 * every visitor the difference, so this runs by default for backdrops.
 */
async function resizeImage(file: File, maxWidth: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width <= maxWidth) {
        resolve(file);
        return;
      }
      const height = Math.round(img.height * (maxWidth / img.width));
      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, maxWidth, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not encode image"));
            return;
          }
          resolve(
            new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
        },
        "image/jpeg",
        0.9,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

const ASPECTS: Record<NonNullable<ImageUploadProps["aspectRatio"]>, number> = {
  landscape: 9 / 16,
  square: 1,
  wide: 1 / 2,
  portrait: 4 / 3,
};

/** Drag-and-drop image field with preview, resize, and clear. */
export function ImageUpload({
  value,
  onChange,
  onUpload,
  label,
  aspectRatio = "landscape",
  previewSize = 300,
  maxWidth,
  disabled = false,
  theme: themeOverride,
}: ImageUploadProps): ReactElement {
  const theme = mergeTheme(themeOverride);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const width = aspectRatio === "portrait"
    ? Math.round((previewSize * 3) / 4)
    : previewSize;
  const height = Math.round(width * ASPECTS[aspectRatio]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file");
        return;
      }
      setError(null);
      setIsUploading(true);
      try {
        const prepared = maxWidth ? await resizeImage(file, maxWidth) : file;
        onChange(await onUpload(prepared));
      } catch (e) {
        console.error("Upload failed", e);
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [maxWidth, onChange, onUpload],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  return (
    <div>
      {label ? (
        <label className="jmc-a-label" style={{ color: theme.textSecondary }}>
          {label}
        </label>
      ) : null}

      <div
        className={`jmc-a-drop${isDragging ? " jmc-a-drop--over" : ""}`}
        style={{
          width,
          height,
          borderColor: isDragging ? theme.accent : theme.elevated3,
          backgroundColor: theme.elevated2,
          color: theme.textTertiary,
          opacity: disabled ? 0.5 : 1,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") inputRef.current?.click();
        }}
        aria-label={label ?? "Upload image"}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="jmc-a-preview" />
        ) : (
          <span className="jmc-a-drop-hint">
            {isUploading ? "Uploading…" : "Drop an image or click to choose"}
          </span>
        )}

        {isUploading ? <span className="jmc-a-drop-veil">Uploading…</span> : null}

        {value && !isUploading ? (
          <button
            type="button"
            className="jmc-a-clear"
            style={{ backgroundColor: theme.error, color: theme.textPrimary }}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            aria-label="Remove image"
          >
            ×
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="jmc-a-error" style={{ color: theme.error }}>
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPick}
      />
    </div>
  );
}
