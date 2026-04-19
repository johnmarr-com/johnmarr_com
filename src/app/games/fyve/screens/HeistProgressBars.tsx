"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { HEIST_ELEMENT_LABELS } from "../fyveTypes";
import type { FyveTeam } from "../fyveTypes";

interface HeistProgressBarsProps {
  t1Score: number;
  t2Score: number;
  activeTeam: FyveTeam | null;
}

const TEAM_CONFIG: Record<FyveTeam, { bg: string; fill: string }> = {
  syndicate1: { bg: "#2A0A0A", fill: "#dc2626" },
  syndicate2: { bg: "#0C1A2E", fill: "#3B82F6" },
};

function ProgressBar({ team, score, active }: { team: FyveTeam; score: number; active: boolean }) {
  const { bg, fill } = TEAM_CONFIG[team];
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [fillPx, setFillPx] = useState(0);
  // Skip transition on first render so remounts don't replay the fill animation
  const [mounted, setMounted] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const clamped = Math.min(Math.max(score, 0), 5);

    if (clamped === 0) {
      setFillPx(0);
      return;
    }
    if (clamped === 5) {
      setFillPx(container.offsetWidth);
      return;
    }

    // Fill to the midpoint between label[clamped-1]'s right edge and label[clamped]'s left edge
    const lastSecured = labelRefs.current[clamped - 1];
    const nextUnsecured = labelRefs.current[clamped];
    if (!lastSecured || !nextUnsecured) return;

    const containerLeft = container.getBoundingClientRect().left;
    const rightEdge = lastSecured.getBoundingClientRect().right - containerLeft;
    const leftEdge = nextUnsecured.getBoundingClientRect().left - containerLeft;
    setFillPx((rightEdge + leftEdge) / 2);
  }, [score]);

  useEffect(() => {
    // Defer first measurement so flex layout is committed
    const raf = requestAnimationFrame(() => {
      measure();
      // Enable transitions after the first paint so remounts appear instant
      requestAnimationFrame(() => { setMounted(true); });
    });
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [measure]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-5 w-full items-center overflow-hidden rounded-full transition-opacity duration-500"
      style={{ backgroundColor: bg, opacity: active ? 1 : 0.2 }}
    >
      {/* Animated fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: fillPx,
          backgroundColor: fill,
          transition: mounted ? "width 800ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
      />
      {/* Labels — justify-around gives half-gap on edges, full gap between */}
      <div className="relative z-10 flex w-full justify-around">
        {HEIST_ELEMENT_LABELS.map((label, i) => {
          const secured = i < score;
          return (
            <span
              key={label}
              ref={(el) => { labelRefs.current[i] = el; }}
              className="text-[10px] font-bold uppercase leading-none tracking-wide"
              style={{
                color: secured ? "#fff" : "rgba(255,255,255,0.7)",
                transition: "color 400ms ease-out",
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function HeistProgressBars({ t1Score, t2Score, activeTeam }: HeistProgressBarsProps) {
  const t1Active = activeTeam === "syndicate1";
  // gap-2 = 8px, so a full swap translates by bar height (20px) + gap (8px) = 28px
  const shift = 28; // h-5 (20px) + gap-2 (8px)

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div style={{ transform: `translateY(${t1Active ? 0 : shift}px)`, transition: "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
        <ProgressBar team="syndicate1" score={t1Score} active={t1Active} />
      </div>
      <div style={{ transform: `translateY(${t1Active ? 0 : -shift}px)`, transition: "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
        <ProgressBar team="syndicate2" score={t2Score} active={!t1Active} />
      </div>
    </div>
  );
}
