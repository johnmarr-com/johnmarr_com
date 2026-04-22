"use client";

import type { ReactNode } from "react";
import Image from "next/image";

const SIGN_MY = "/images/games/boaty/Sign-My-Swamp.png";
const SIGN_THEIR = "/images/games/boaty/Sign-Their-Swamp.png";

interface SwampSignFrameProps {
  variant: "my" | "their";
  children: ReactNode;
}

/** Sign art behind the swamp: ~65% of half grid width (32.5% of board); bottom edge locked to grid top (`bottom-full`). */
export default function SwampSignFrame({ variant, children }: SwampSignFrameProps) {
  const src = variant === "my" ? SIGN_MY : SIGN_THEIR;
  return (
    <div className="relative mx-auto mb-[15px] w-full max-w-[500px] shrink-0">
      <Image
        src={src}
        alt=""
        width={200}
        height={200}
        className="pointer-events-none absolute bottom-full left-1/2 z-0 w-[32.5%] h-auto max-w-none -translate-x-1/2 select-none object-contain object-bottom"
        draggable={false}
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
