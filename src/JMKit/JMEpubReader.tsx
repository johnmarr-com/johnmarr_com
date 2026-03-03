"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ReactReader, ReactReaderStyle } from "react-reader";
import type { Rendition } from "epubjs";
import { X, Sun, Moon, Minus, Plus } from "lucide-react";
import type { JMStorySettings } from "@/lib/content-types";

interface JMEpubReaderProps {
  title: string;
  epubURL: string;
  initialLocation?: string | undefined;
  settings: JMStorySettings;
  onSettingsChange: (s: Partial<JMStorySettings>) => void;
  onLocationChange: (cfi: string) => void;
  onClose: () => void;
}

export function JMEpubReader({
  title,
  epubURL,
  initialLocation,
  settings,
  onSettingsChange,
  onLocationChange,
  onClose,
}: JMEpubReaderProps) {
  const [location, setLocation] = useState<string | null>(initialLocation || null);
  const [showSettings, setShowSettings] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const locationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    locationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const xhr = new XMLHttpRequest();
    xhr.open("GET", epubURL, true);
    xhr.responseType = "blob";
    xhr.onload = () => {
      if (!cancelled && xhr.status === 200) {
        objectUrl = URL.createObjectURL(xhr.response);
        setBlobUrl(objectUrl);
      } else if (!cancelled) {
        setBlobUrl(epubURL);
      }
    };
    xhr.onerror = () => {
      if (!cancelled) setBlobUrl(epubURL);
    };
    xhr.send();

    return () => {
      cancelled = true;
      xhr.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [epubURL]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleLocationChanged = useCallback((epubcfi: string) => {
    setLocation(epubcfi);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      locationChangeRef.current(epubcfi);
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const applyTheme = useCallback((rendition: Rendition) => {
    renditionRef.current = rendition;

    const customCSS = `
      object { display: none !important; }
      img { max-width: 100% !important; height: auto !important; display: block !important; margin: 1em auto !important; }
      figure { max-width: 100% !important; margin: 1em auto !important; }
      svg { max-width: 100% !important; height: auto !important; }
    `;

    // Handle in-content link clicks (Vellum TOC, cross-references)
    rendition.on("linkClicked", (href: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loc = rendition.location as any;
        const current = loc?.start?.href;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const book = rendition.book as any;
        const resolved = current && book.path?.resolve
          ? book.path.resolve(href, current)
          : href;
        rendition.display(resolved);
      } catch {
        console.error("TOC link failed:", href);
      }
    });

    rendition.hooks.content.register((contents: { document: Document; addStylesheetCss: (css: string, key: string) => Promise<boolean> }) => {
      contents.addStylesheetCss(customCSS, "jm-custom");

      const body = contents.document.body;

      // Hide in-content TOC page, replace with hint
      const tocNav = body.querySelector('nav[epub\\:type="toc"]')
        || body.querySelector('[role="doc-toc"]')
        || body.querySelector('nav.toc');
      if (tocNav) {
        tocNav.innerHTML = "";
        const hint = contents.document.createElement("p");
        hint.textContent = "Tap the upper left menu icon to see the Table of Contents.";
        hint.style.cssText = "text-align: center; opacity: 0.5; font-style: italic; padding: 2em 1em;";
        tocNav.appendChild(hint);
      }

      const walker = contents.document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
      );
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.includes("\uFFFC")) {
          node.nodeValue = node.nodeValue.replace(/\uFFFC/g, "");
        }
      }
    });

    rendition.themes.register("dark", {
      "body": {
        color: "#e0e0e0 !important",
        "background-color": "#0f0f0f !important",
      },
      "p, span, div, h1, h2, h3, h4, h5, h6, li, a, em, strong, blockquote": {
        color: "#e0e0e0 !important",
      },
    });

    rendition.themes.register("light", {
      "body": {
        color: "#1a1a1a !important",
        "background-color": "#faf9f6 !important",
      },
      "p, span, div, h1, h2, h3, h4, h5, h6, li, a, em, strong, blockquote": {
        color: "#1a1a1a !important",
      },
    });

    rendition.themes.select(settings.darkMode ? "dark" : "light");
    rendition.themes.fontSize(`${settings.fontSize}px`);
  }, [settings.darkMode, settings.fontSize]);

  useEffect(() => {
    const r = renditionRef.current;
    if (!r) return;
    r.themes.select(settings.darkMode ? "dark" : "light");
    r.themes.fontSize(`${settings.fontSize}px`);
  }, [settings.darkMode, settings.fontSize]);

  const dark = settings.darkMode;
  const bg = dark ? "#0f0f0f" : "#faf9f6";
  const textPrimary = dark ? "#e0e0e0" : "#1a1a1a";
  const textSecondary = dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  const border = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  const readerStyles: typeof ReactReaderStyle = {
    ...ReactReaderStyle,
    container: {
      ...ReactReaderStyle.container,
      overflow: "hidden",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    readerArea: {
      ...ReactReaderStyle.readerArea,
      backgroundColor: bg,
      transition: "background-color 0.3s",
    },
    titleArea: {
      ...ReactReaderStyle.titleArea,
      color: textSecondary,
      fontWeight: 400,
      fontSize: "0.75rem",
    },
    arrow: {
      ...ReactReaderStyle.arrow,
      color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
    },
    arrowHover: {
      ...ReactReaderStyle.arrowHover,
      color: dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
    },
    tocBackground: {
      ...ReactReaderStyle.tocBackground,
      background: "rgba(0,0,0,0.5)",
    },
    toc: {
      ...ReactReaderStyle.toc,
      background: dark ? "#1a1a1a" : "#fff",
      color: textPrimary,
    },
    tocArea: {
      ...ReactReaderStyle.tocArea,
    },
    tocAreaButton: {
      ...ReactReaderStyle.tocAreaButton,
      color: textPrimary,
    },
    tocButton: {
      ...ReactReaderStyle.tocButton,
      color: textSecondary,
    },
    tocButtonExpanded: {
      ...ReactReaderStyle.tocButtonExpanded,
      color: textPrimary,
    },
    tocButtonBar: {
      ...ReactReaderStyle.tocButtonBar,
      background: textSecondary,
    },
    tocButtonBarTop: {
      ...ReactReaderStyle.tocButtonBarTop,
    },
    tocButtonBottom: {
      ...ReactReaderStyle.tocButtonBottom,
    },
    loadingView: {
      ...ReactReaderStyle.loadingView,
      color: textSecondary,
    },
    errorView: {
      ...ReactReaderStyle.errorView,
    },
    containerExpanded: {
      ...ReactReaderStyle.containerExpanded,
    },
    reader: {
      ...ReactReaderStyle.reader,
    },
    swipeWrapper: {
      ...ReactReaderStyle.swipeWrapper,
    },
    prev: {
      ...ReactReaderStyle.prev,
    },
    next: {
      ...ReactReaderStyle.next,
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: bg }}>
      {/* Top Bar */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3 relative z-10"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <h1
          className="text-sm font-medium truncate flex-1 mr-4"
          style={{ color: textPrimary }}
        >
          {title}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: showSettings
                ? (dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)")
                : "transparent",
              color: textSecondary,
            }}
          >
            Aa
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: textSecondary }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Settings Drawer */}
      {showSettings && (
        <div
          className="shrink-0 flex items-center justify-center gap-6 px-4 py-3 relative z-10"
          style={{ borderBottom: `1px solid ${border}`, backgroundColor: bg }}
        >
          <button
            onClick={() => onSettingsChange({ darkMode: !dark })}
            className="p-2 rounded-lg transition-colors"
            style={{
              color: textPrimary,
              backgroundColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onSettingsChange({ fontSize: Math.max(12, settings.fontSize - 2) })}
              className="p-1.5 rounded-lg transition-colors"
              style={{
                color: textPrimary,
                backgroundColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
              }}
            >
              <Minus size={16} />
            </button>
            <span className="text-xs tabular-nums w-8 text-center" style={{ color: textSecondary }}>
              {settings.fontSize}
            </span>
            <button
              onClick={() => onSettingsChange({ fontSize: Math.min(32, settings.fontSize + 2) })}
              className="p-1.5 rounded-lg transition-colors"
              style={{
                color: textPrimary,
                backgroundColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Reader */}
      <div className="flex-1 relative">
        {blobUrl ? (
          <ReactReader
            url={blobUrl}
            title={title}
            location={location}
            locationChanged={handleLocationChanged}
            getRendition={applyTheme}
            readerStyles={readerStyles}
            showToc={true}
            swipeable={true}
            epubInitOptions={{ openAs: "epub" }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: textSecondary }}>Loading book...</span>
          </div>
        )}
      </div>
    </div>
  );
}
