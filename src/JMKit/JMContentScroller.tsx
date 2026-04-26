"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ContentItem {
  id: string;
  name: string;
  coverURL: string;
  contentType: "show" | "story" | "card" | "game" | "artist";
  slug?: string | undefined;
}

interface JMContentScrollerProps {
  title: string;
  /** When true, prepends "Fast Casual" before the title in lighter mid-gray. */
  fastCasual?: boolean;
  items: ContentItem[];
  rowScaleMobile?: number | undefined;
  rowScaleDesktop?: number | undefined;
  onItemClick?: (item: ContentItem) => void;
}

const BASE_HEIGHT = 130;
const MD_BREAKPOINT = 768;

function getAspectRatio(contentType: ContentItem["contentType"]): number {
  switch (contentType) {
    case "story":
      return 3 / 4;
    case "game":
      return 1 / 1;
    default:
      return 2 / 1;
  }
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(`(min-width: ${MD_BREAKPOINT}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function JMContentScroller({ 
  title, 
  fastCasual = false,
  items,
  rowScaleMobile = 1,
  rowScaleDesktop = 1,
  onItemClick 
}: JMContentScrollerProps) {
  const { theme } = useJMStyle();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDesktop = useIsDesktop();

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
    }
    return () => {
      if (el) el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [items]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (items.length === 0) {
    return null;
  }

  const rowScale = isDesktop ? rowScaleDesktop : rowScaleMobile;
  const rowHeight = BASE_HEIGHT * rowScale;
  const isGameRow = items.length > 1 && items.every(item => item.contentType === "game");

  const gameRowMinHeight = isGameRow ? rowHeight * 1.22 : undefined;

  return (
    <div className="relative group mx-auto max-w-[1500px] overflow-x-visible">
      {/* Row title */}
      <h2 
        className="mb-3 sm:mb-4 px-4 sm:px-6 lg:px-8 text-lg sm:text-xl md:text-2xl font-semibold"
        style={{ color: theme.text.primary }}
      >
        {fastCasual && (
          <span className="font-normal" style={{ color: theme.text.disabled }}>
            Fast Casual{" "}
          </span>
        )}
        {title}
      </h2>

      {/* Scroll container */}
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden sm:flex absolute left-0 top-0 bottom-0 z-10 w-12 items-center justify-center transition-opacity"
            style={{
              background: `linear-gradient(to right, ${theme.surfaces.base} 0%, transparent 100%)`,
            }}
            aria-label="Scroll left"
          >
            <div 
              className="rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: `${theme.surfaces.elevated1}cc` }}
            >
              <ChevronLeft className="h-5 w-5" style={{ color: theme.text.primary }} />
            </div>
          </button>
        )}

        {/* Items row */}
        <div
          ref={scrollRef}
          className={`flex min-h-0 overflow-x-auto overflow-y-visible scrollbar-hide ${
            isGameRow
              ? "group/gamerow items-center gap-6 sm:gap-8"
              : "gap-3 sm:gap-4 pb-2"
          }`}
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollPaddingInlineStart: 25,
            minHeight: gameRowMinHeight,
          }}
        >
          <div className="shrink-0 w-[25px]" aria-hidden />
          {items.map((item) => {
            const isStory = item.contentType === "story";
            const isGame = item.contentType === "game";
            const aspect = getAspectRatio(item.contentType);
            const itemWidth = rowHeight * aspect;
            const borderRadius = isGame
              ? `${rowHeight * 0.2}px`
              : undefined;

            const tile = (
              <div
                className={`relative overflow-hidden ${isGame ? "" : "rounded-lg"}`}
                style={{
                  height: rowHeight,
                  width: itemWidth,
                  backgroundColor: theme.surfaces.elevated2,
                  boxShadow: isStory
                    ? "0 2px 16px rgba(0,0,0,0.5)"
                    : "0 4px 12px rgba(0,0,0,0.3)",
                  ...(borderRadius ? { borderRadius } : {}),
                }}
              >
                {item.coverURL ? (
                  <Image
                    src={item.coverURL}
                    alt={item.name}
                    fill
                    sizes={`${Math.round(itemWidth)}px`}
                    className={`object-cover ${
                      isGameRow && isGame
                        ? ""
                        : "transition-transform duration-300 group-hover/item:scale-110"
                    }`}
                  />
                ) : (
                  <div
                    className={`flex h-full w-full flex-col items-center justify-center ${
                      isGameRow && isGame
                        ? ""
                        : "transition-transform duration-300 group-hover/item:scale-110"
                    } ${isStory ? "gap-2 px-3" : ""}`}
                    style={{ color: theme.text.tertiary }}
                  >
                    {isStory ? (
                      <>
                        <span className="text-3xl font-serif">{item.name.charAt(0)}</span>
                        <span className="text-xs text-center leading-tight opacity-70">
                          {item.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold">{item.name.charAt(0)}</span>
                    )}
                  </div>
                )}
              </div>
            );

            return (
              <div
                key={item.id}
                onClick={() => onItemClick?.(item)}
                className={`shrink-0 cursor-pointer group/item ${
                  isGameRow
                    ? "relative transition-opacity duration-300 group-hover/gamerow:opacity-40 hover:opacity-100! hover:z-20"
                    : ""
                }`}
                style={{ scrollSnapAlign: "start" }}
              >
                {isGameRow && isGame ? (
                  <div className="flex items-center justify-center will-change-transform">
                    <div
                      className="origin-center transition-transform duration-300 group-hover/item:scale-110"
                      style={{ width: itemWidth, height: rowHeight }}
                    >
                      {tile}
                    </div>
                  </div>
                ) : (
                  tile
                )}
              </div>
            );
          })}
        </div>

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden sm:flex absolute right-0 top-0 bottom-0 z-10 w-12 items-center justify-center transition-opacity"
            style={{
              background: `linear-gradient(to left, ${theme.surfaces.base} 0%, transparent 100%)`,
            }}
            aria-label="Scroll right"
          >
            <div 
              className="rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: `${theme.surfaces.elevated1}cc` }}
            >
              <ChevronRight className="h-5 w-5" style={{ color: theme.text.primary }} />
            </div>
          </button>
        )}
      </div>

      {/* Hide scrollbar */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
