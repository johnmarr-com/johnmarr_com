"use client";

interface DefinitionCardProps {
  definition: string;
  roundNumber: number;
  totalRounds: number;
  /** Render at smaller size (e.g. during voting/results). */
  compact?: boolean;
}

export default function DefinitionCard({
  definition,
  roundNumber,
  totalRounds,
  compact = false,
}: DefinitionCardProps) {
  return (
    <div className="relative" style={{ margin: "65px 50px 0" }}>
      {/* Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-linear-to-br from-gray-200 via-white to-gray-200 ${
          compact ? "p-4" : "p-6"
        }`}
      >
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest" style={{ color: "#c2185b" }}>
          Round {roundNumber} of {totalRounds}
        </p>
        <p
          className={`text-center font-bold leading-relaxed text-gray-900 ${
            compact ? "text-base" : "text-lg sm:text-xl"
          }`}
        >
          &ldquo;{definition}&rdquo;
        </p>
      </div>
      {/* Curled-paper shadow — behind card, anchored to card bottom */}
      <svg
        aria-hidden
        className="pointer-events-none absolute left-1/2 z-[-1]"
        style={{ bottom: 0, width: "calc(100% - 10px)", transform: "translateX(-50%)", height: 30, filter: "drop-shadow(0 16px 10px rgba(0,0,0,0.3))" }}
        viewBox="0 0 200 30"
        preserveAspectRatio="none"
      >
        <path d="M0,0 L200,0 L200,20 Q200,30 190,30 Q100,4 10,30 Q0,30 0,20 Z" fill="white" />
      </svg>
    </div>
  );
}
