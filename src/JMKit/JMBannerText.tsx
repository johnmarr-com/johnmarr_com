"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

export interface JMBannerTextProps {
  children: ReactNode;
  color?: string;
  /** Extra horizontal padding beyond the text width */
  paddingX?: number;
  paddingY?: number;
  /** How far the left/right midpoints pinch inward */
  notch?: number;
  borderColor?: string;
  borderWidth?: number;
  className?: string;
}

export function JMBannerText({
  children,
  color = "#000000",
  paddingX = 24,
  paddingY = 6,
  notch = 10,
  borderColor,
  borderWidth = 0,
  className = "",
}: JMBannerTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!textRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(textRef.current);
    return () => ro.disconnect();
  }, []);

  const totalW = size.w + paddingX * 2;
  const totalH = size.h + paddingY * 2;
  const midY = totalH / 2;

  const points = [
    `0,0`,
    `${totalW},0`,
    `${totalW - notch},${midY}`,
    `${totalW},${totalH}`,
    `0,${totalH}`,
    `${notch},${midY}`,
  ].join(" ");

  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {size.w > 0 && (
        <svg
          className="absolute inset-0"
          width={totalW}
          height={totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        >
          <polygon
            points={points}
            fill={color}
            stroke={borderColor}
            strokeWidth={borderWidth || 0}
            strokeLinejoin="miter"
          />
        </svg>
      )}
      <span
        ref={textRef}
        className="relative"
        style={{ padding: `${paddingY}px ${paddingX}px` }}
      >
        {children}
      </span>
    </span>
  );
}
