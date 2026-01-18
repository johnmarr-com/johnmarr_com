"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export type AdminFocus = "users" | "show" | "story" | "card" | "game" | null;

interface JMAdminDropdownProps {
  value: AdminFocus;
  onChange: (value: AdminFocus) => void;
}

const focusOptions: { value: AdminFocus; label: string }[] = [
  { value: "users", label: "Users" },
  { value: "show", label: "Shows" },
  { value: "story", label: "Stories" },
  { value: "card", label: "Cards" },
  { value: "game", label: "Games" },
];

/**
 * JMAdminDropdown - Dropdown for selecting admin focus area
 * 
 * Styled to match the menu system: black bg, white text, pink hover
 */
export function JMAdminDropdown({ value, onChange }: JMAdminDropdownProps) {
  const { theme } = useJMStyle();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get display label
  const selectedLabel = value 
    ? focusOptions.find(opt => opt.value === value)?.label 
    : "Select Focus";

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleSelect = (newValue: AdminFocus) => {
    onChange(newValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
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

      {/* Dropdown menu */}
      <div
        className="absolute top-full left-0 mt-1 w-full overflow-hidden transition-all duration-200 ease-out rounded-lg shadow-lg"
        style={{
          maxHeight: isOpen ? "300px" : "0px",
          opacity: isOpen ? 1 : 0,
          backgroundColor: theme.surfaces.base,
          border: isOpen ? `1px solid ${theme.surfaces.elevated2}` : "none",
          zIndex: 50,
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
      </div>
    </div>
  );
}
