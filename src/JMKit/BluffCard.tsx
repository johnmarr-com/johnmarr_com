"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { JMCard } from "./JMCard";

interface BluffCardProps {
  imageURL: string;
  /** Fixed pixel size. Omit to fill the parent container. */
  size?: number | undefined;
  /**
   * When true, the card does not capture pointer/touch (parent handles scrolling).
   * Use in read-only grids so trackpad/touch scroll the list instead of hitting the image.
   */
  nonInteractive?: boolean | undefined;
}

export function BluffCard({ imageURL, size, nonInteractive = false }: BluffCardProps) {
  return (
    <JMCard
      className={cn("bg-neutral-800", nonInteractive && "pointer-events-none")}
      style={size ? { width: size, height: size } : { width: "100%", aspectRatio: "1 / 1" }}
    >
      <Image
        src={imageURL}
        alt=""
        fill
        draggable={false}
        sizes={size ? `${size}px` : "(max-width: 640px) 33vw, 150px"}
        className="object-cover select-none"
      />
    </JMCard>
  );
}
