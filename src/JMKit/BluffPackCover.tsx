"use client";

import Image from "next/image";
import { JMCard } from "./JMCard";

interface BluffPackCoverProps {
  coverImageURL: string;
  /** Used for image `alt` only (titles live in the artwork). */
  name: string;
  /** Fixed pixel size. Omit to fill the parent container. */
  size?: number | undefined;
}

export function BluffPackCover({ coverImageURL, name, size }: BluffPackCoverProps) {
  return (
    <JMCard
      className="bg-neutral-800"
      style={size ? { width: size, height: size } : { width: "100%", aspectRatio: "1 / 1" }}
    >
      <Image
        src={coverImageURL}
        alt={name.trim() ? name : "Pack cover"}
        fill
        sizes={size ? `${size}px` : "(max-width: 640px) 50vw, 400px"}
        className="object-cover"
      />
    </JMCard>
  );
}
