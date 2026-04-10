"use client";

interface JMProButtonProps {
  /** Text displayed after "PRO:" */
  title: string;
  onClick: () => void;
  className?: string;
}

export function JMProButton({ title, onClick, className = "" }: JMProButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 border-red-500 bg-amber-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-black/40 drop-shadow-lg transition-all hover:scale-105 hover:brightness-110 active:scale-95 ${className}`}
    >
      <span className="text-[13px] font-black text-red-600">PRO:</span>{" "}
      <span className="text-black">{title}</span>
    </button>
  );
}
