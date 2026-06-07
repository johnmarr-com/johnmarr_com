'use client';

import { useState, useEffect, useRef } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { extractAvatarId, getAvatarScale } from '@/lib';
import { getCachedAvatar, loadAvatar } from '@/lib/avatar-cache';
import { JMLiquidLoader } from './JMLiquidLoader';

interface JMAvatarViewProps {
  width: number;
  avatarName: string;
  responsive?: boolean;
  fullFilename?: string;
  interactive?: boolean;
  scaleOverride?: number;
}

export default function JMAvatarView({ width, avatarName, responsive = false, fullFilename, interactive = false, scaleOverride }: JMAvatarViewProps) {
  // If the avatar was preloaded (e.g. during gameplay), render it instantly.
  const cachedInit = getCachedAvatar(fullFilename || avatarName) ?? null;
  const [animationData, setAnimationData] = useState<object | null>(cachedInit);
  const [isLoading, setIsLoading] = useState(false); // Start as false for lazy loading
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoadAnimation, setShouldLoadAnimation] = useState(false);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState<boolean>(!!cachedInit);
  const [showLoader, setShowLoader] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  // Calculate circle size (90% of width)
  const circleSize = width * 0.9;

  const avatarId = extractAvatarId(fullFilename || avatarName);
  const scaleModifier = scaleOverride ?? (avatarId ? getAvatarScale(avatarId) : 1.0);

  // Intersection Observer for visibility detection
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      // Fallback for SSR or browsers without IntersectionObserver: load now.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no observer to drive visibility; enable loading + visibility on mount
      setShouldLoadAnimation(true);
      setIsVisible(true);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const newIsVisible = entry.isIntersecting;
          setIsVisible(newIsVisible);
          
          // Start loading animation when first visible
          if (newIsVisible && !shouldLoadAnimation) {
            setShouldLoadAnimation(true);
          }
          
          // Control animation playback based on visibility
          if (lottieRef.current) {
            if (newIsVisible) {
              lottieRef.current.play();
            } else {
              lottieRef.current.pause();
            }
          }
        });
      },
      {
        rootMargin: '50px', // Start loading slightly before entering viewport
        threshold: 0.1
      }
    );

    const currentContainer = containerRef.current;
    if (currentContainer) {
      observer.observe(currentContainer);
    }

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
    };
  }, [shouldLoadAnimation]);

  // Lazy load animation data only when needed (shared cache → loads once,
  // and renders instantly if it was preloaded during gameplay).
  useEffect(() => {
    if (!shouldLoadAnimation) return;
    const fileToLoad = fullFilename || avatarName;
    if (!fileToLoad) return;

    let cancelled = false;

    const loadAnimation = async () => {
      // Cache hit (e.g. preloaded during gameplay) → render now, no loader.
      const cached = getCachedAvatar(fileToLoad);
      if (cached) {
        setAnimationData(cached);
        setIsAvatarLoaded(true);
        setShowLoader(false);
        setHasError(false);
        return;
      }

      setIsLoading(true);
      setShowLoader(true);
      setHasError(false);
      setIsAvatarLoaded(false);

      const data = await loadAvatar(fileToLoad);
      if (cancelled) return;

      if (data) {
        setAnimationData(data);
        // Small delay before starting fade-in
        setTimeout(() => {
          if (cancelled) return;
          setIsAvatarLoaded(true);
          // Hide loader after fade-in completes
          setTimeout(() => {
            if (!cancelled) setShowLoader(false);
          }, 300); // Match fade-in duration
        }, 100);
      } else {
        setHasError(true);
        setShowLoader(false);
      }
      setIsLoading(false);
    };

    void loadAnimation();

    return () => {
      cancelled = true;
    };
  }, [avatarName, fullFilename, shouldLoadAnimation]);

  return (
    <div 
      ref={containerRef}
      className={`relative flex items-center justify-center ${
        responsive ? 'w-full h-full' : ''
      }`}
      style={responsive ? {} : { 
        width: `${width}px`, 
        height: `${width}px` 
      }}
    >
      {/* White circle background - 90% of container size */}
      <div
        className={`absolute bg-black/20 rounded-full ${
          responsive ? 'w-[90%] h-[90%]' : ''
        }`}
        style={responsive ? {} : {
          width: `${circleSize}px`,
          height: `${circleSize}px`,
        }}
      />
      
      {/* Loading overlay - positioned behind the avatar */}
      {showLoader && (
        <div className="absolute inset-0 flex items-center justify-center z-5">
          <JMLiquidLoader 
            style={{ 
              width: '50%', 
              height: '50%',
              filter: 'saturate(0) brightness(1.5)'
            }} 
          />
        </div>
      )}
      
      {/* Avatar content */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {hasError && (
          <div className="text-red-400 text-xs">Error</div>
        )}
        
        {animationData && !hasError && (
          <Lottie
            lottieRef={lottieRef}
            animationData={animationData}
            loop={true}
            autoplay={isVisible}
            className={`transition-opacity duration-300 ease-out ${
              isAvatarLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              width: `${90 * scaleModifier}%`,
              height: `${90 * scaleModifier}%`,
              transform: scaleModifier !== 1.0 ? `scale(${scaleModifier})` : undefined,
              // Safari: force a composite layer so CSS `transform: scale()` re-rasterises the SVG crisply
              // instead of stretching the original bitmap.
              willChange: scaleModifier !== 1.0 ? 'transform' : undefined,
              WebkitBackfaceVisibility: scaleModifier !== 1.0 ? 'hidden' : undefined,
              pointerEvents: interactive ? 'auto' : 'none',
            }}
          />
        )}
        
        {!shouldLoadAnimation && !isLoading && !hasError && (
          <div className="text-gray-500 text-xs bg-gray-700 rounded px-2 py-1">
            {avatarName.split('-')[1]?.slice(0, 8) || 'Avatar'}
          </div>
        )}
      </div>
    </div>
  );
}
