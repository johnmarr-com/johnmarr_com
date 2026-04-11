"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export type AdminFocus = "users" | "avatars" | "featured" | "alert" | "brands" | "homerows" | "show" | "story" | "card" | "game" | "artist" | "auction" | "levels" | "points" | "aipersonas" | null;

interface JMAdminDropdownProps {
  value: AdminFocus;
  onChange: (value: AdminFocus) => void;
}

/**
 * Alphabetized for column-first reading in a 2-column grid:
 * Col 1 (top→bottom): AI Artists, AI Personas, Alert, Auctions, Avatars, Brands, Cards, Featured
 * Col 2 (top→bottom): Games, Home Rows, Levels, Points, Shows, Stories, Users
 */
const SORTED: { value: AdminFocus; label: string }[] = [
  { value: "artist", label: "AI Artists" },
  { value: "aipersonas", label: "AI Personas" },
  { value: "alert", label: "Alert" },
  { value: "auction", label: "Auctions" },
  { value: "avatars", label: "Avatars" },
  { value: "brands", label: "Brands" },
  { value: "card", label: "Cards" },
  { value: "featured", label: "Featured" },
  { value: "game", label: "Games" },
  { value: "homerows", label: "Home Rows" },
  { value: "levels", label: "Levels" },
  { value: "points", label: "Points" },
  { value: "show", label: "Shows" },
  { value: "story", label: "Stories" },
  { value: "users", label: "Users" },
];

function interleaveForColumns(items: typeof SORTED, cols: number) {
  const rows = Math.ceil(items.length / cols);
  const result: typeof SORTED = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = c * rows + r;
      if (idx < items.length) result.push(items[idx]!);
    }
  }
  return result;
}

const focusOptions = interleaveForColumns(SORTED, 2);

/**
 * JMAdminDropdown - Dropdown for selecting admin focus area
 * 
 * Styled to match the menu system: black bg, white text, pink hover
 * Uses a portal to ensure the dropdown menu always appears on top of all content
 */
export function JMAdminDropdown({ value, onChange }: JMAdminDropdownProps) {
  const { theme } = useJMStyle();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get display label
  const selectedLabel = value 
    ? focusOptions.find(opt => opt.value === value)?.label 
    : "Select Focus";

  // Update menu position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4, // 4px gap below button
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current && 
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
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

  // Close on scroll to avoid misaligned menu
  useEffect(() => {
    if (!isOpen) return;
    
    const handleScroll = () => setIsOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  const handleSelect = (newValue: AdminFocus) => {
    onChange(newValue);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-150"
        style={{
          backgroundColor: theme.surfaces.base,
          borderColor: theme.surfaces.elevated2,
          color: value ? theme.text.primary : theme.text.tertiary,
          minWidth: "160px",
        }}
      >
        <span className="flex-1 text-left text-sm">{selectedLabel}</span>
        <ChevronDown 
          size={16} 
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          style={{ color: theme.text.tertiary }}
        />
      </button>

      {/* Dropdown menu - rendered via portal to ensure it's always on top */}
      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="grid grid-cols-2 overflow-hidden rounded-lg shadow-xl"
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: Math.min(menuPosition.left, window.innerWidth - 340),
            width: Math.max(menuPosition.width, 320),
            backgroundColor: theme.surfaces.base,
            border: `1px solid ${theme.surfaces.elevated2}`,
            zIndex: 9999,
          }}
        >
          {focusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="px-4 py-3 text-left text-sm transition-all duration-150"
              style={{
                color: theme.text.primary,
                borderBottom: `1px solid ${theme.surfaces.elevated2}`,
                backgroundColor: value === option.value ? theme.surfaces.elevated1 : "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme.accents.goldenGlow;
                e.currentTarget.style.fontWeight = "700";
                e.currentTarget.style.backgroundColor = theme.surfaces.elevated1;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme.text.primary;
                e.currentTarget.style.fontWeight = "400";
                e.currentTarget.style.backgroundColor = value === option.value ? theme.surfaces.elevated1 : "transparent";
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
