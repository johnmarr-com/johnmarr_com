"use client";

import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { Eraser, Undo2, Trash2 } from "lucide-react";
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
          style={{ width: "100%", maxWidth: CANVAS_SIZE, aspectRatio: "1 / 1" }}
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

        {/* Canvas */}
        <div
          style={{ width: "100%", maxWidth: CANVAS_SIZE, aspectRatio: "1 / 1" }}
          className="rounded-lg overflow-hidden border-2 border-white/20"
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

        {/* Colors + Eraser — centered row */}
        {!readOnly && (
          <div className="flex items-center justify-center gap-1.5">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorPick(color)}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  strokeColor === color && !eraseMode
                    ? "scale-110 border-white shadow-lg"
                    : "border-white/20 hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
              />
            ))}
            <button
              onClick={toggleEraser}
              className={`ml-2 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                eraseMode
                  ? "scale-110 border-white bg-white text-black shadow-lg"
                  : "border-white/40 bg-white/25 text-white/80 hover:scale-105 hover:bg-white/35"
              }`}
              aria-label="Eraser"
            >
              <Eraser className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    );
  },
);
