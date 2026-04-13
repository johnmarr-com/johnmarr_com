"use client";

import Image from "next/image";
import { JMCard } from "./JMCard";

interface BluffCardProps {
  imageURL: string;
  /** Fixed pixel size. Omit to fill the parent container. */
  size?: number | undefined;
}

export function BluffCard({ imageURL, size }: BluffCardProps) {
  return (
    <JMCard
      className="bg-neutral-800"
      style={size ? { width: size, height: size } : { width: "100%", aspectRatio: "1 / 1" }}
    >
      <Image
        src={imageURL}
        alt=""
        fill
        sizes={size ? `${size}px` : "(max-width: 640px) 33vw, 150px"}
        className="object-cover"
      />
      <span className="absolute bottom-1 right-1.5 text-[7px] font-bold text-white/30 drop-shadow">
        BluffBox @ JohnMarr.com
      </span>
    </JMCard>
  );
}
