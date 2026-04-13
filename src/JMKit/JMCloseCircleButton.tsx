"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JMCloseCircleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Defaults to "Close". */
  "aria-label"?: string;
}

/**
 * Circular close control: dark red fill, white Lucide X. Hover (desktop) brightens the red;
 * the icon scales up inside the fixed-size circle.
 */
export const JMCloseCircleButton = React.forwardRef<HTMLButtonElement, JMCloseCircleButtonProps>(
  function JMCloseCircleButton(
    { "aria-label": ariaLabel = "Close", className, type = "button", ...rest },
    ref,
  ) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      className={cn(
        "group flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full",
        "bg-red-950 text-white shadow-md",
        "transition-colors duration-200 hover:bg-red-800",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
        "active:scale-95 disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      <X
        className="h-5.5 w-5.5 shrink-0 transition-transform duration-200 ease-out group-hover:scale-125 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        strokeWidth={2.5}
        aria-hidden
      />
    </button>
  );
  },
);

JMCloseCircleButton.displayName = "JMCloseCircleButton";
