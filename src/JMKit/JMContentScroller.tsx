"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ContentItem {
  id: string;
  name: string;
  coverURL: string;
  contentType: "show" | "story" | "card" | "game";
}

interface JMContentScrollerProps {
  title: string;
  items: ContentItem[];
  onItemClick?: (item: ContentItem) => void;
}

export function JMContentScroller({ 
  title, 
  items, 
  onItemClick 
}: JMContentScrollerProps) {
  const { theme } = useJMStyle();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to show/hide arrows
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

  return (
    <div className="relative group">
      {/* Row title */}
      <h2 
        className="mb-3 sm:mb-4 px-4 sm:px-6 lg:px-8 text-lg sm:text-xl md:text-2xl font-semibold"
        style={{ color: theme.text.primary }}
      >
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
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-2"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => onItemClick?.(item)}
              className="shrink-0 cursor-pointer group/item"
              style={{ scrollSnapAlign: "start" }}
            >
              {/* 2:1 wide cover */}
              <div 
                className="relative w-44 sm:w-56 md:w-64 lg:w-72 aspect-2/1 rounded-lg overflow-hidden"
                style={{ 
                  backgroundColor: theme.surfaces.elevated2,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                {item.coverURL ? (
                  <Image
                    src={item.coverURL}
                    alt={item.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover/item:scale-110"
                  />
                ) : (
                  <div 
                    className="h-full w-full flex items-center justify-center text-2xl font-bold transition-transform duration-300 group-hover/item:scale-110"
                    style={{ color: theme.text.tertiary }}
                  >
                    {item.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>
          ))}
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
