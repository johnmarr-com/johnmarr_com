"use client";

import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { Eraser, Undo2, Trash2, Palette } from "lucide-react";
import { ReactSketchCanvas, type ReactSketchCanvasRef } from "react-sketch-canvas";

const CANVAS_SIZE = 720;

const COLORS = [
  "#000000",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#ffffff",
] as const;

/** Pick a legible icon color for a swatch background. */
function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

export interface SketchCanvasRef {
  exportJpeg: () => Promise<Blob>;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}

interface SketchCanvasProps {
  readOnly?: boolean;
  /** Background image URL to display (for viewing received sketches) */
  backgroundImage?: string;
  className?: string;
}

export const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  function SketchCanvas({ readOnly = false, backgroundImage, className = "" }, ref) {
    const canvasRef = useRef<ReactSketchCanvasRef | null>(null);
    const [strokeColor, setStrokeColor] = useState<string>(COLORS[0]);
    const [eraseMode, setEraseMode] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);

    useEffect(() => {
      canvasRef.current?.eraseMode(eraseMode);
    }, [eraseMode]);

    const handleColorPick = useCallback((color: string) => {
      setEraseMode(false);
      setStrokeColor(color);
    }, []);

    const toggleEraser = useCallback(() => {
      setEraseMode((prev) => !prev);
    }, []);

    useImperativeHandle(ref, () => ({
      exportJpeg: async () => {
        if (!canvasRef.current) throw new Error("Canvas not ready");
        const dataUrl = await canvasRef.current.exportImage("jpeg");
        const res = await fetch(dataUrl);
        return res.blob();
      },
      clear: () => canvasRef.current?.clearCanvas(),
      undo: () => canvasRef.current?.undo(),
      redo: () => canvasRef.current?.redo(),
    }));

    if (readOnly && backgroundImage) {
      return (
        <div
          className={`relative ${className}`}
          style={{ width: "100%", maxWidth: CANVAS_SIZE, aspectRatio: "4 / 3" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt="Sketch"
            className="h-full w-full rounded-lg object-contain"
            draggable={false}
          />
        </div>
      );
    }

    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {/* Undo (top-left) / Clear (top-right) above canvas */}
        <div className="flex w-full items-center justify-between" style={{ maxWidth: CANVAS_SIZE }}>
          <button
            onClick={() => canvasRef.current?.undo()}
            className="flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/20 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white/80 transition-colors hover:bg-white/30"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </button>
          <button
            onClick={() => canvasRef.current?.clearCanvas()}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-400/20 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-red-400/80 transition-colors hover:bg-red-400/30"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>

        {/* Canvas + floating color control (over the canvas, top-right) */}
        <div className="relative w-full" style={{ maxWidth: CANVAS_SIZE }}>
          <div
            style={{ aspectRatio: "4 / 3" }}
            className="w-full rounded-lg overflow-hidden border-2 border-white/20"
          >
            <ReactSketchCanvas
              ref={canvasRef}
              width="100%"
              height="100%"
              strokeColor={strokeColor}
              strokeWidth={4}
              eraserWidth={20}
              canvasColor="#ffffff"
              style={{ border: "none" }}
            />
          </div>

          {/* Color-wheel button — shows the current color; tap for the palette. */}
          <button
            onClick={() => setPaletteOpen((o) => !o)}
            className="absolute right-2 top-2 z-20 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform active:scale-95"
            style={{ backgroundColor: eraseMode ? "#ffffff" : strokeColor }}
            aria-label="Pick a color"
          >
            {eraseMode ? (
              <Eraser className="h-5 w-5 text-black" />
            ) : (
              <Palette className="h-5 w-5" style={{ color: isLightColor(strokeColor) ? "#000000" : "#ffffff" }} />
            )}
          </button>

          {/* Palette popup — same colors + eraser as before, now reachable. */}
          {paletteOpen && (
            <div className="absolute right-2 top-16 z-20 rounded-2xl border border-white/20 bg-neutral-900/95 p-3 shadow-xl backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-2.5">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      handleColorPick(color);
                      setPaletteOpen(false);
                    }}
                    className={`h-10 w-10 rounded-full border-2 transition-transform ${
                      strokeColor === color && !eraseMode
                        ? "scale-110 border-white shadow-lg"
                        : "border-white/20 hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  toggleEraser();
                  setPaletteOpen(false);
                }}
                className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                  eraseMode
                    ? "border-white bg-white text-black"
                    : "border-white/40 bg-white/15 text-white/80 hover:bg-white/25"
                }`}
              >
                <Eraser className="h-5 w-5" />
                Eraser
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);
