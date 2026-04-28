"use client";

import { JMTextCard } from "@/JMKit";

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
    <div style={{ margin: "65px 50px 0" }}>
      <JMTextCard
        text={`“${definition}”`}
        header={`Round ${roundNumber} of ${totalRounds}`}
        headerColor="#c2185b"
        compact={compact}
        fontSize={compact ? "md" : "lg"}
      />
    </div>
  );
}
