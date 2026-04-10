"use client";

import { Loader2 } from "lucide-react";

interface GamePrimaryButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "green" | "white";
  className?: string;
}

export function GamePrimaryButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = "green",
  className = "",
}: GamePrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const base = "w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wider transition-all";
  const colorClass =
    variant === "green"
      ? "bg-green-500 text-black shadow-lg shadow-green-500/20"
      : "bg-white text-black shadow-lg shadow-white/20";
  const interactiveClass = isDisabled
    ? "opacity-50 cursor-not-allowed"
    : "hover:scale-[1.02] active:scale-95";

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${base} ${colorClass} ${interactiveClass} ${className}`}
    >
      {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : children}
    </button>
  );
}
