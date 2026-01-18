"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useJMStyle } from "@/JMStyle";
import { signOut } from "@/lib/auth";

export interface JMMenuOption {
  label: string;
  href?: string;
  onClick?: () => void | Promise<void>;
}

interface JMBasicMenuProps {
  /** The trigger element (e.g., button with user name) */
  children: React.ReactNode;
  /** Menu options to display */
  options?: JMMenuOption[];
  /** Menu width in pixels (default: 150) */
  width?: number;
  /** Offset from right edge in pixels (default: 15) */
  rightOffset?: number;
  /** Header height in pixels - menu top aligns with this (default: 75) */
  headerHeight?: number;
}

/**
 * JMBasicMenu - Animated dropdown menu that slides down from behind the header
 * 
 * Features:
 * - Desktop: Hover to open, click to toggle
 * - Mobile: Tap to toggle, tap outside to close
 * - Smooth slide animation
 * - Theme-aware styling
 * - White text with hot pink hover
 */
export function JMBasicMenu({
  children,
  options,
  width = 150,
  rightOffset = 0,
  headerHeight = 75,
}: JMBasicMenuProps) {
  const { theme } = useJMStyle();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Detect touch device using ref to avoid re-renders
  const isTouchDevice = useRef(false);
  useEffect(() => {
    isTouchDevice.current = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }, []);

  // Default menu options
  const defaultOptions: JMMenuOption[] = [
    { label: "Home", href: "/" },
    { label: "Profile", href: "/profile" },
    { 
      label: "Sign Out", 
      onClick: async () => {
        await signOut();
        router.push("/auth");
      }
    },
  ];

  const menuOptions = options || defaultOptions;

  // Handle mouse enter - only for non-touch devices
  const handleMouseEnter = () => {
    if (isTouchDevice.current) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  // Handle mouse leave - only for non-touch devices
  const handleMouseLeave = () => {
    if (isTouchDevice.current) return;
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  // Handle click/tap on trigger
  const handleTriggerClick = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Close menu when clicking/tapping outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside both the trigger and the dropdown menu
      const isOutsideTrigger = menuRef.current && !menuRef.current.contains(target);
      const isOutsideDropdown = menuDropdownRef.current && !menuDropdownRef.current.contains(target);
      
      if (isOutsideTrigger && isOutsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleOptionClick = async (option: JMMenuOption) => {
    setIsOpen(false);
    
    if (option.onClick) {
      await option.onClick();
    } else if (option.href) {
      router.push(option.href);
    }
  };

  return (
    <div 
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      <div 
        onClick={handleTriggerClick}
        className="cursor-pointer select-none"
      >
        {children}
      </div>

      {/* Menu dropdown - positioned behind header with z-index lower than header's z-50 */}
      <div
        ref={menuDropdownRef}
        className="fixed overflow-hidden transition-all duration-300 ease-out"
        style={{
          top: `${headerHeight}px`, // Menu top aligns with header bottom
          right: `${rightOffset}px`,
          width: `${width}px`,
          maxHeight: isOpen ? "300px" : "0px",
          opacity: isOpen ? 1 : 0,
          zIndex: 40, // Below header's z-50
        }}
      >
        <div
          className="rounded-b-lg shadow-lg"
          style={{
            backgroundColor: theme.surfaces.base,
            borderLeft: `1px solid ${theme.surfaces.elevated2}`,
            borderRight: `1px solid ${theme.surfaces.elevated2}`,
            borderBottom: `1px solid ${theme.surfaces.elevated2}`,
          }}
        >
          {menuOptions.map((option, index) => (
            <button
              key={option.label}
              onClick={() => handleOptionClick(option)}
              className="w-full px-4 py-3 text-left text-sm transition-all duration-150"
              style={{
                color: theme.text.primary,
                borderTop: index > 0 ? `1px solid ${theme.surfaces.elevated2}` : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme.accents.neonPink;
                e.currentTarget.style.fontWeight = "700";
                e.currentTarget.style.backgroundColor = theme.surfaces.elevated1;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme.text.primary;
                e.currentTarget.style.fontWeight = "400";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
