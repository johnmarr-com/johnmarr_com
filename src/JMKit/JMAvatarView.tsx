'use client';

import { useState, useEffect, useRef } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { devError } from '@/lib/logger';
import { extractAvatarId, getAvatarScale } from '@/lib';
import { JMLiquidLoader } from './JMLiquidLoader';

interface JMAvatarViewProps {
  width: number;
  avatarName: string;
  responsive?: boolean; // If true, ignore width and fill container
  fullFilename?: string; // Full filename with ID for loading
  interactive?: boolean; // If true, allow pointer events for interaction
}

export default function JMAvatarView({ width, avatarName, responsive = false, fullFilename, interactive = false }: JMAvatarViewProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Start as false for lazy loading
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoadAnimation, setShouldLoadAnimation] = useState(false);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  // Calculate circle size (90% of width)
  const circleSize = width * 0.9;

  // Extract avatar ID and get scale modifier
  const avatarId = extractAvatarId(fullFilename || avatarName);
  const scaleModifier = avatarId ? getAvatarScale(avatarId) : 1.0;

  // Intersection Observer for visibility detection
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      // Fallback for SSR or browsers without IntersectionObserver
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

  // Lazy load animation data only when needed
  useEffect(() => {
    if (!shouldLoadAnimation) return;

    const loadAnimation = async () => {
      setIsLoading(true);
      setShowLoader(true);
      setHasError(false);
      setIsAvatarLoaded(false);
      
      try {
        // Use fullFilename if provided, otherwise use avatarName
        const fileToLoad = fullFilename || avatarName;
        const url = fileToLoad.endsWith('.json') 
          ? `/avatars/${fileToLoad}`
          : `/avatars/${fileToLoad}.json`;
          
        const response = await window.fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          setAnimationData(data);
          
          // Small delay before starting fade-in
          setTimeout(() => {
            setIsAvatarLoaded(true);
            // Hide loader after fade-in completes
            setTimeout(() => {
              setShowLoader(false);
            }, 300); // Match fade-in duration
          }, 100);
        } else {
          setHasError(true);
          setShowLoader(false);
        }
      } catch (error) {
        devError('Failed to load avatar animation:', fullFilename || avatarName, error);
        setHasError(true);
        setShowLoader(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (avatarName) {
      loadAnimation();
    }
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
