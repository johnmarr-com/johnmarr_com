"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Default stacking layer — above typical app dialogs (`z-50`). */
export const JM_SELECT_ASSET_Z = "z-[200]";

/** Layer for detail / confirmation stepped above the asset sheet (above `JM_SELECT_ASSET_Z`). */
export const JM_SELECT_ASSET_DETAIL_Z = "z-[500]";

export interface JMSelectAssetTab {
  id: string;
  label: string;
  visible?: boolean;
}

export interface JMSelectAssetProps<T> {
  /** When false, nothing is rendered (no portal). */
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  tabs: JMSelectAssetTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  items: T[];
  itemKey: (item: T) => string;
  /** Row body (thumbnail + text). Chevron is appended by the shell. */
  renderItem: (item: T) => ReactNode;
  onItemPress: (item: T) => void;
  /** Stacking above parent modals; default {@link JM_SELECT_ASSET_Z}. */
  zIndexClass?: string;
  className?: string;
  /**
   * When true (e.g. a second portal is open on top), disables hit-testing on this layer so
   * the overlay above can receive taps. Use with detail views at {@link JM_SELECT_ASSET_DETAIL_Z}.
   */
  suspendInteractions?: boolean;
}

/**
 * Modal asset picker (missions, packs, etc.): centered panel with ~25px inset,
 * full-screen dimmed backdrop. Portals to `document.body` above in-flow modals.
 */
export function JMSelectAsset<T>({
  open,
  onClose,
  title,
  subtitle,
  tabs,
  activeTabId,
  onTabChange,
  loading = false,
  emptyMessage = "Nothing to show here yet.",
  items,
  itemKey,
  renderItem,
  onItemPress,
  zIndexClass = JM_SELECT_ASSET_Z,
  className,
  suspendInteractions = false,
}: JMSelectAssetProps<T>) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const visibleTabs = tabs.filter((t) => t.visible !== false);

  const node = (
    <div
      className={cn("pointer-events-none fixed inset-0 flex flex-col", zIndexClass, className)}
      role="dialog"
      aria-modal="true"
      aria-hidden={suspendInteractions}
      aria-labelledby="jm-select-asset-title"
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 z-0 bg-black/70 backdrop-blur-md",
          suspendInteractions ? "pointer-events-none" : "pointer-events-auto",
        )}
        onClick={onClose}
        aria-label="Close"
        tabIndex={suspendInteractions ? -1 : 0}
      />

      <div
        className={cn(
          "relative z-10 flex min-h-0 min-w-0 flex-1 flex-col",
          suspendInteractions ? "pointer-events-none" : "pointer-events-auto",
        )}
        style={{
          paddingTop: "max(25px, env(safe-area-inset-top))",
          paddingBottom: "max(25px, env(safe-area-inset-bottom))",
          paddingLeft: "max(25px, env(safe-area-inset-left))",
          paddingRight: "max(25px, env(safe-area-inset-right))",
        }}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/15",
            "bg-linear-to-b from-neutral-950 via-neutral-900 to-neutral-950 shadow-2xl shadow-black/50",
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.1),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(59,130,246,0.07),transparent)]"
            aria-hidden
          />

          <div className="relative z-20 flex shrink-0 flex-col">
            <header className="relative flex shrink-0 items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
            <div className="min-w-0 flex-1">
              <h2
                id="jm-select-asset-title"
                className="text-2xl font-black tracking-tight text-white sm:text-3xl"
              >
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 text-base text-white/55 sm:text-lg">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white/80 transition-colors hover:bg-white/15 active:scale-95"
              aria-label="Close"
            >
              <X className="h-7 w-7" />
            </button>
            </header>

            <div className="relative shrink-0 px-5 pb-3 sm:px-6">
              <div
                className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
              >
                {visibleTabs.map((tab) => {
                  const active = tab.id === activeTabId;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onTabChange(tab.id)}
                      className={cn(
                        "shrink-0 rounded-2xl px-5 py-3 text-base font-bold transition-all active:scale-[0.98]",
                        active
                          ? "bg-white text-neutral-900 shadow-lg shadow-black/20"
                          : "bg-white/10 text-white/75 hover:bg-white/15 hover:text-white",
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6"
            style={{ WebkitOverflowScrolling: "touch" }}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {loading ? (
              <div className="flex flex-1 justify-center py-24">
                <Loader2 className="h-10 w-10 animate-spin text-amber-400/40" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-20 text-center text-lg text-white/45">{emptyMessage}</p>
            ) : (
              <ul className="mx-auto flex max-w-2xl flex-col gap-3">
                {items.map((item) => (
                  <li key={itemKey(item)}>
                    <button
                      type="button"
                      onClick={() => onItemPress(item)}
                      className="flex w-full min-h-22 items-center gap-4 rounded-3xl bg-white/[0.07] px-4 py-4 text-left transition-transform active:scale-[0.99] sm:min-h-24 sm:px-5 sm:py-5"
                    >
                      <div className="min-w-0 flex-1">{renderItem(item)}</div>
                      <ChevronRight
                        className="h-8 w-8 shrink-0 text-white/35 sm:h-9 sm:w-9"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
