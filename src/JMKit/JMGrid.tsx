"use client";

import { useJMStyle } from "@/JMStyle";

export interface JMGridItem {
  id: string;
  name: string;
  subtitle?: string;
  coverURL: string;
  contentType: string;
  slug?: string;
  engineSlug?: string;
}

interface JMGridProps {
  items: JMGridItem[];
  cellAspect: "landscape" | "portrait" | "square";
  textAlign: "left" | "center" | "right";
  showTitle: boolean;
  showSubtitle: boolean;
  title: { fontFamily: string; size: number };
  subtitle: { fontFamily: string; size: number };
  columns: { desktop: number; tablet: number; mobile: number };
  onItemClick?: (item: JMGridItem) => void;
}

// Literal class maps so Tailwind JIT keeps them. Columns drive per-device layout
// via container queries (mobile <734, tablet 734–1069, desktop 1070+).
const COLS: Record<number, string> = {
  1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4",
  5: "grid-cols-5", 6: "grid-cols-6", 7: "grid-cols-7", 8: "grid-cols-8",
};
const COLS_MD: Record<number, string> = {
  1: "@min-[734px]:grid-cols-1", 2: "@min-[734px]:grid-cols-2",
  3: "@min-[734px]:grid-cols-3", 4: "@min-[734px]:grid-cols-4",
  5: "@min-[734px]:grid-cols-5", 6: "@min-[734px]:grid-cols-6",
  7: "@min-[734px]:grid-cols-7", 8: "@min-[734px]:grid-cols-8",
};
const COLS_LG: Record<number, string> = {
  1: "@min-[1070px]:grid-cols-1", 2: "@min-[1070px]:grid-cols-2",
  3: "@min-[1070px]:grid-cols-3", 4: "@min-[1070px]:grid-cols-4",
  5: "@min-[1070px]:grid-cols-5", 6: "@min-[1070px]:grid-cols-6",
  7: "@min-[1070px]:grid-cols-7", 8: "@min-[1070px]:grid-cols-8",
};
const ASPECT: Record<JMGridProps["cellAspect"], string> = {
  landscape: "aspect-video",
  portrait: "aspect-[3/4]",
  square: "aspect-square",
};
const ALIGN: Record<JMGridProps["textAlign"], string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const clampCols = (n: number): number => Math.min(8, Math.max(1, Math.round(n)));

export function JMGrid({
  items,
  cellAspect,
  textAlign,
  showTitle,
  showSubtitle,
  title,
  subtitle,
  columns,
  onItemClick,
}: JMGridProps) {
  const { theme } = useJMStyle();

  if (items.length === 0) return null;

  const cols = `${COLS[clampCols(columns.mobile)] ?? ""} ${
    COLS_MD[clampCols(columns.tablet)] ?? ""
  } ${COLS_LG[clampCols(columns.desktop)] ?? ""}`;

  return (
    <div className="@container w-full">
      <div className={`grid gap-3 sm:gap-4 ${cols}`}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item)}
            className={`group flex flex-col gap-2 ${ALIGN[textAlign]}`}
          >
            <div
              className={`w-full overflow-hidden rounded-xl ${ASPECT[cellAspect]}`}
              style={{ backgroundColor: theme.surfaces.elevated1 }}
            >
              {item.coverURL && (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic content cover URL
                <img
                  src={item.coverURL}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
            </div>
            {(showTitle || showSubtitle) && (
              <div className="px-0.5">
                {showTitle && (
                  <p
                    className="font-bold leading-tight"
                    style={{
                      fontFamily: title.fontFamily,
                      fontSize: title.size,
                      color: theme.text.primary,
                    }}
                  >
                    {item.name}
                  </p>
                )}
                {showSubtitle && item.subtitle && (
                  <p
                    className="leading-snug"
                    style={{
                      fontFamily: subtitle.fontFamily,
                      fontSize: subtitle.size,
                      color: theme.text.secondary,
                    }}
                  >
                    {item.subtitle}
                  </p>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
