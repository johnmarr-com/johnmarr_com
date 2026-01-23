"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export type AdminFocus = "users" | "avatars" | "featured" | "alert" | "brands" | "homerows" | "show" | "story" | "card" | "game" | null;

interface JMAdminDropdownProps {
  value: AdminFocus;
  onChange: (value: AdminFocus) => void;
}

const focusOptions: { value: AdminFocus; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "homerows", label: "Home Rows" },
  { value: "alert", label: "Alert" },
  { value: "brands", label: "Brands" },
  { value: "users", label: "Users" },
  { value: "show", label: "Shows" },
  { value: "story", label: "Stories" },
  { value: "card", label: "Cards" },
  { value: "game", label: "Games" },
  { value: "avatars", label: "Avatars" },
];

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
          className="overflow-hidden rounded-lg shadow-xl"
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            backgroundColor: theme.surfaces.base,
            border: `1px solid ${theme.surfaces.elevated2}`,
            zIndex: 9999,
          }}
        >
          {focusOptions.map((option, index) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="w-full px-4 py-3 text-left text-sm transition-all duration-150"
              style={{
                color: theme.text.primary,
                borderTop: index > 0 ? `1px solid ${theme.surfaces.elevated2}` : undefined,
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
