"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Laptop, Smartphone, Tablet } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

const DEVICE_ORDER: PreviewDevice[] = ["desktop", "tablet", "mobile"];

// Representative container widths per tier (desktop = fluid full width). Each
// lands inside its container-query band: tablet 734–1069, mobile <734.
const DEVICE_WIDTH: Record<PreviewDevice, number | null> = {
  desktop: null,
  tablet: 834,
  mobile: 390,
};

const DEVICE_LABEL: Record<PreviewDevice, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

const DEVICE_ICON = { desktop: Laptop, tablet: Tablet, mobile: Smartphone };

/** Which device previews fit the current screen (can't preview wider than it). */
function allowedFor(screenWidth: number): PreviewDevice[] {
  if (screenWidth >= 1070) return ["desktop", "tablet", "mobile"];
  if (screenWidth >= 734) return ["tablet", "mobile"];
  return ["mobile"];
}

/**
 * Drives a device preview: tracks the screen width, exposes which devices fit,
 * auto-selects the widest that fits, and yields a container style. Because the
 * previewed component is container-query driven, sizing the container to the
 * device width shows exactly what production renders at that width.
 */
export function useDevicePreview() {
  const [screenWidth, setScreenWidth] = useState(1280);
  const [device, setDevice] = useState<PreviewDevice>("desktop");

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setScreenWidth(w);
      setDevice((prev) => {
        const allowed = allowedFor(w);
        return allowed.includes(prev) ? prev : (allowed[0] ?? "mobile");
      });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const allowed = allowedFor(screenWidth);
  const widthPx = DEVICE_WIDTH[device];
  const containerStyle: CSSProperties = widthPx
    ? { width: `${widthPx}px`, maxWidth: "100%", marginInline: "auto" }
    : { width: "100%" };

  return { device, setDevice, allowed, containerStyle };
}

export function DeviceTabs({
  device,
  setDevice,
  allowed,
}: {
  device: PreviewDevice;
  setDevice: (d: PreviewDevice) => void;
  allowed: PreviewDevice[];
}) {
  const { theme } = useJMStyle();
  return (
    <div className="flex gap-1">
      {DEVICE_ORDER.map((d) => {
        const enabled = allowed.includes(d);
        const active = device === d;
        const Icon = DEVICE_ICON[d];
        return (
          <button
            key={d}
            type="button"
            disabled={!enabled}
            onClick={() => setDevice(d)}
            className="flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all disabled:opacity-30"
            style={{
              borderColor: active
                ? theme.accents.neonPink
                : theme.surfaces.elevated2,
              color: active ? theme.surfaces.base : theme.text.secondary,
              backgroundColor: active ? theme.accents.neonPink : "transparent",
              cursor: enabled ? "pointer" : "not-allowed",
            }}
            title={
              enabled
                ? `${DEVICE_LABEL[d]} preview`
                : `Screen too narrow for ${DEVICE_LABEL[d]} preview`
            }
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{DEVICE_LABEL[d]}</span>
          </button>
        );
      })}
    </div>
  );
}
