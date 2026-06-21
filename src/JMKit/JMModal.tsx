"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export interface JMModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional footer (e.g. action buttons), pinned below the scroll area. */
  footer?: ReactNode;
  /** Tailwind max-width class for the panel. Defaults to a comfortable form width. */
  maxWidthClass?: string;
}

/**
 * JMModal — a themed, centered modal shell. Overlay click and Escape close it;
 * the body scrolls when tall. Sits above in-page editors (z-80). A reusable
 * shell for settings panels, pickers, and confirmations.
 */
export function JMModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = "max-w-xl",
}: JMModalProps) {
  const { theme } = useJMStyle();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Dialog"}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      />

      {/* Panel */}
      <div
        className={`relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border-2 ${maxWidthClass}`}
        style={{
          backgroundColor: theme.surfaces.base,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: theme.surfaces.elevated2 }}
        >
          <h2 className="text-base font-bold" style={{ color: theme.text.primary }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5"
            style={{ color: theme.text.secondary }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && (
          <div
            className="flex items-center justify-end gap-3 border-t px-4 py-3"
            style={{ borderColor: theme.surfaces.elevated2 }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
