"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Autoplay, Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { useJMStyle } from "@/JMStyle";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

// Import Swiper styles
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";

export interface FeaturedItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  backdropURL: string;
  contentId: string;  // Links to actual content
  contentType: "show" | "story" | "card" | "game";
}

interface JMFeaturedCarouselProps {
  items: FeaturedItem[];
  onItemClick?: (item: FeaturedItem) => void;
  autoplayDelay?: number;  // ms between slides
}

export function JMFeaturedCarousel({ 
  items, 
  onItemClick,
  autoplayDelay = 6000 
}: JMFeaturedCarouselProps) {
  const { theme } = useJMStyle();
  const [swiperRef, setSwiperRef] = useState<SwiperType | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Pause autoplay on hover
  useEffect(() => {
    if (!swiperRef?.autoplay) return;
    
    if (isHovered) {
      swiperRef.autoplay.stop();
    } else {
      swiperRef.autoplay.start();
    }
  }, [isHovered, swiperRef]);

  const handlePrev = useCallback(() => {
    if (!swiperRef) return;
    swiperRef.slidePrev();
  }, [swiperRef]);

  const handleNext = useCallback(() => {
    if (!swiperRef) return;
    swiperRef.slideNext();
  }, [swiperRef]);

  if (items.length === 0) {
    return null;
  }

  // For proper looping with coverflow, we need at least 5 slides
  // If we have fewer items, duplicate them
  const displayItems = items.length >= 5 
    ? items 
    : items.length >= 3 
      ? [...items, ...items].slice(0, Math.max(5, items.length * 2))
      : [...items, ...items, ...items, ...items, ...items].slice(0, 5);

  return (
    <div 
      className="relative w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Carousel */}
      <div className="relative">
        <Swiper
          onSwiper={setSwiperRef}
          onSlideChange={(swiper) => setActiveIndex(swiper.realIndex % items.length)}
          effect="coverflow"
          grabCursor
          centeredSlides
          slidesPerView="auto"
          loop={true}
          speed={400}
          coverflowEffect={{
            rotate: 0,
            stretch: 0,
            depth: 100,
            modifier: 2.5,
            slideShadows: false,
          }}
          autoplay={{
            delay: autoplayDelay,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          modules={[EffectCoverflow, Autoplay, Navigation]}
          className="featured-carousel"
          style={{
            paddingTop: "12px",
            paddingBottom: "24px",
          }}
        >
          {displayItems.map((item, idx) => (
            <SwiperSlide 
              key={`${item.id}-${idx}`}
              className="featured-slide"
            >
              {({ isActive }) => (
                <div
                  onClick={() => onItemClick?.(item)}
                  className="slide-content relative aspect-video cursor-pointer overflow-hidden rounded-lg sm:rounded-xl transition-all duration-300"
                  style={{
                    boxShadow: isActive 
                      ? `0 25px 50px -12px rgba(0,0,0,0.5)` 
                      : `0 10px 30px -10px rgba(0,0,0,0.3)`,
                  }}
                >
                  {/* Backdrop Image */}
                  <Image
                    src={item.backdropURL}
                    alt={item.title}
                    fill
                    className="object-cover transition-all duration-300"
                    style={{
                      filter: isActive ? "none" : "brightness(0.4)",
                    }}
                  />
                  
                  {/* Gradient overlay for text readability - only on active */}
                  {isActive && (
                    <div 
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 35%, transparent 60%)",
                      }}
                    />
                  )}

                  {/* Content overlay - only visible on active slide */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 md:p-6 lg:p-8">
                      {/* Description - shown on all screen sizes */}
                      {item.description && (
                        <p 
                          className="mb-2 sm:mb-3 md:mb-4 line-clamp-2 max-w-xl text-xs sm:text-sm md:text-base"
                          style={{ color: theme.text.secondary }}
                        >
                          {item.description}
                        </p>
                      )}
                      
                      {/* Play/View button */}
                      <button
                        className="inline-flex items-center gap-1 sm:gap-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 lg:px-6 text-xs sm:text-sm font-semibold transition-all duration-200 hover:scale-105"
                        style={{
                          backgroundColor: theme.accents.goldenGlow,
                          color: theme.surfaces.base,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick?.(item);
                        }}
                      >
                        <Play className="h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" />
                        {item.contentType === "show" ? "Watch Now" : "View"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Navigation arrows - hidden on mobile, visible on hover for desktop */}
        {items.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="hidden sm:flex absolute left-2 md:left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 md:p-3 transition-all duration-200 hover:scale-110 items-center justify-center"
              style={{
                backgroundColor: `${theme.surfaces.elevated1}cc`,
                color: theme.text.primary,
                opacity: isHovered ? 1 : 0,
              }}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <button
              onClick={handleNext}
              className="hidden sm:flex absolute right-2 md:right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 md:p-3 transition-all duration-200 hover:scale-110 items-center justify-center"
              style={{
                backgroundColor: `${theme.surfaces.elevated1}cc`,
                color: theme.text.primary,
                opacity: isHovered ? 1 : 0,
              }}
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
            </button>
          </>
        )}
      </div>

      {/* Pagination dots */}
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 sm:gap-2 pb-2 sm:pb-4">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => swiperRef?.slideToLoop(index)}
              className="h-1.5 sm:h-2 rounded-full transition-all duration-300"
              style={{
                width: index === activeIndex ? "16px" : "6px",
                backgroundColor: index === activeIndex 
                  ? theme.accents.goldenGlow 
                  : theme.text.tertiary,
                opacity: index === activeIndex ? 1 : 0.5,
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Custom styles for the carousel */}
      <style jsx global>{`
        .featured-carousel .swiper-slide {
          transition: transform 0.3s ease, opacity 0.3s ease;
        }
        .featured-carousel .swiper-slide:not(.swiper-slide-active) {
          opacity: 0.6;
        }
        .featured-carousel .swiper-slide-active {
          opacity: 1;
        }
        
        /* Responsive slide widths - back to original sizing */
        .featured-slide {
          width: 85% !important;
          max-width: 900px;
        }
        
        @media (min-width: 640px) {
          .featured-slide {
            width: 75% !important;
          }
        }
        
        @media (min-width: 768px) {
          .featured-slide {
            width: 65% !important;
          }
        }
        
        @media (min-width: 1024px) {
          .featured-slide {
            width: 60% !important;
          }
        }
      `}</style>
    </div>
  );
}
