"use client";

import { useEffect, useState, useRef } from 'react';
import Lottie from 'lottie-react';

export interface JMLiquidLoaderProps {
  /** Size in pixels (default: 30) */
  size?: number;
  /** Additional styles */
  style?: React.CSSProperties;
}

// Global animation cache - loaded once and shared across all instances
let globalAnimationData: object | null = null;
let loadingPromise: Promise<object | null> | null = null;

// Preload animation data immediately when module is imported
const preloadAnimationData = async (): Promise<object | null> => {
  if (globalAnimationData) {
    return globalAnimationData;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      if (typeof window !== 'undefined') {
        const response = await window.fetch('/lottie/wave-loader-purple.json');
        if (response.ok) {
          const data = await response.json();
          globalAnimationData = data;
          return data;
        }
      }
    } catch (error) {
      console.error('Failed to preload liquid loader animation:', error);
    }
    return null;
  })();

  return loadingPromise;
};

// Start preloading immediately when module is imported
if (typeof window !== 'undefined') {
  preloadAnimationData();
}

/**
 * JMLiquidLoader - Animated loading indicator using Lottie
 * 
 * A purple wave loader animation. Preloads globally for instant display.
 * 
 * Usage:
 * ```tsx
 * <JMLiquidLoader size={40} />
 * ```
 */
export function JMLiquidLoader({ size = 30, style }: JMLiquidLoaderProps) {
  const [animationData, setAnimationData] = useState<object | null>(globalAnimationData);
  const [isAnimationReady, setIsAnimationReady] = useState(false);
  const isMountedRef = useRef(false);

  // Load animation data on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!animationData) {
      preloadAnimationData().then((data) => {
        if (isMountedRef.current && data) {
          setAnimationData(data);
        }
      });
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [animationData]);

  // Handle animation ready state
  const handleAnimationReady = () => {
    setIsAnimationReady(true);
  };

  // Return nothing during SSR or while loading
  if (!animationData) {
    return null;
  }

  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        ...style,
        opacity: isAnimationReady ? 1 : 0,
        transition: 'opacity 0.1s ease-in'
      }}
    >
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        onLoopComplete={handleAnimationReady}
        onEnterFrame={handleAnimationReady}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent'
        }}
      />
    </div>
  );
} 