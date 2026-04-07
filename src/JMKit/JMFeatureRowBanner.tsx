"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import type { JMFeatureRowItem } from "@/lib/content-types";

interface JMFeatureRowBannerProps {
  item: JMFeatureRowItem;
  rowScaleMobile?: number | undefined;
  rowScaleDesktop?: number | undefined;
  onClick?: () => void;
}

const BASE_HEIGHT_SM = 150;
const BASE_HEIGHT_MD = 175;
const BASE_HEIGHT_LG = 200;
const MD_BREAKPOINT = 768;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(`(min-width: ${MD_BREAKPOINT}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function JMFeatureRowBanner({ item, rowScaleMobile = 1, rowScaleDesktop = 1, onClick }: JMFeatureRowBannerProps) {
  const { theme } = useJMStyle();
  const isDesktop = useIsDesktop();
  const scale = isDesktop ? rowScaleDesktop : rowScaleMobile;

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className="relative block w-full max-w-[1500px] mx-auto rounded-lg overflow-hidden cursor-pointer"
        style={{
          height: `clamp(${BASE_HEIGHT_SM * scale}px, ${BASE_HEIGHT_MD * scale}px, ${BASE_HEIGHT_LG * scale}px)`,
          backgroundColor: theme.surfaces.elevated2,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <Image
          src={item.rowBannerURL}
          alt={item.name}
          fill
          sizes="100vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </button>
    </div>
  );
}
