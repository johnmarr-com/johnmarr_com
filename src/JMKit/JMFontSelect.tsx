"use client";

import { useEffect, useState } from "react";
import { JM_FONTS, ensureJMFont, jmFontFamily } from "./JMFonts";

export interface JMFontSelectProps {
  /** Role label shown above the select, e.g. "Title Font". */
  label: string;
  /** Selected font id from the JMFonts registry. */
  value: string | undefined;
  onChange: (fontId: string) => void;
  /** Sample text rendered live in the selected font. */
  sampleText?: string;
}

/**
 * JMFontSelect — dropdown over the central JMFonts registry, with a live
 * sample of the selected face. Add fonts in JMFonts.ts and every selector
 * picks them up.
 */
export function JMFontSelect({ label, value, onChange, sampleText }: JMFontSelectProps) {
  const [, setLoadedTick] = useState(0);

  // Load the selected font so the sample renders true; re-render when ready.
  useEffect(() => {
    let cancelled = false;
    void ensureJMFont(value).then(() => {
      if (!cancelled) setLoadedTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-white/40">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/20 bg-neutral-800 px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400/50"
      >
        {!value && <option value="">Choose a font…</option>}
        {JM_FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      {sampleText !== undefined && (
        <p
          className="truncate rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xl text-white"
          style={{ fontFamily: jmFontFamily(value) }}
        >
          {sampleText}
        </p>
      )}
    </div>
  );
}
