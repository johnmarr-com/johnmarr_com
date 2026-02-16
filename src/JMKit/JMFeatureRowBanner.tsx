"use client";

import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import type { JMFeatureRowItem } from "@/lib/content-types";

interface JMFeatureRowBannerProps {
  item: JMFeatureRowItem;
  onClick?: () => void;
}

/**
 * Feature row banner - full-width row with single image (1500×750px recommended).
 * Same height as content row cards, max 1500px wide. Responsive: height fixed, width narrows with object-fit contain.
 */
export function JMFeatureRowBanner({ item, onClick }: JMFeatureRowBannerProps) {
  const { theme } = useJMStyle();

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className="relative block w-full max-w-[1500px] mx-auto h-[150px] md:h-[175px] lg:h-[200px] rounded-lg overflow-hidden cursor-pointer"
        style={{
          backgroundColor: theme.surfaces.elevated2,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <Image
          src={item.rowBannerURL}
          alt={item.name}
          fill
          className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </button>
    </div>
  );
}
