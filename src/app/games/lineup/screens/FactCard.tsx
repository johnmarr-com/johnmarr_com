"use client";

import { JMTextCard } from "@/JMKit";
import { useGameColors } from "@/app/games/_gamecore";

interface FactCardProps {
  fact: string;
  factNumber: number;
  totalFacts: number;
  /** Render at smaller size (e.g. during voting/results). */
  compact?: boolean;
}

/**
 * The same card Wordonkulous uses to show a definition — here it shows the
 * fun fact up for guessing (author hidden), headed "Fact X of Y" and themed
 * to the game's CMS colors.
 */
export default function FactCard({
  fact,
  factNumber,
  totalFacts,
  compact = false,
}: FactCardProps) {
  const { primary } = useGameColors();
  return (
    <div style={{ margin: "65px 50px 0" }}>
      <JMTextCard
        text={`“${fact}”`}
        header={`Fact ${factNumber} of ${totalFacts}`}
        headerColor={primary}
        compact={compact}
        fontSize={compact ? "md" : "lg"}
      />
    </div>
  );
}
