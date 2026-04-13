"use client";

import type {
  IdeogramImageOptions,
  IdeogramMagicPrompt,
  IdeogramRenderingSpeed,
  IdeogramStylePresetV3,
  IdeogramStyleType,
} from "./ideogramImageTypes";
import { STYLE_PRESET_OPTIONS } from "./ideogramStylePresetOptions";
import { isStyleTypeDisabledWhenPresetSelected } from "./ideogramStyleRules";

function mergeIdeogram(
  prev: IdeogramImageOptions,
  patch: Partial<IdeogramImageOptions>,
): IdeogramImageOptions {
  return { ...prev, ...patch };
}

function RadioGroup<T extends string>({
  legend,
  value,
  onChange,
  options,
  name,
  isOptionDisabled,
}: {
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  name: string;
  /** Ideogram: e.g. Fiction + style_preset is invalid. */
  isOptionDisabled?: (option: T) => boolean;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/35">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const selected = value === o.value;
          const disabled = isOptionDisabled?.(o.value) ?? false;
          return (
            <label
              key={o.value}
              htmlFor={id}
              title={
                disabled ? "[Auto + General Modes Only] — required when using a style preset (Ideogram API)" : undefined
              }
              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                disabled
                  ? "cursor-not-allowed border-white/5 bg-white/2 text-white/25"
                  : `cursor-pointer ${
                      selected
                        ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                        : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:bg-white/10"
                    }`
              }`}
            >
              <input
                id={id}
                type="radio"
                className="sr-only"
                name={name}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const RENDERING: { value: IdeogramRenderingSpeed; label: string }[] = [
  { value: "FLASH", label: "Flash" },
  { value: "TURBO", label: "Turbo" },
  { value: "DEFAULT", label: "Default" },
  { value: "QUALITY", label: "Quality" },
];

const STYLE: { value: IdeogramStyleType; label: string }[] = [
  { value: "AUTO", label: "Auto" },
  { value: "GENERAL", label: "General" },
  { value: "REALISTIC", label: "Realistic" },
  { value: "DESIGN", label: "Design" },
];

const MAGIC: { value: IdeogramMagicPrompt; label: string }[] = [
  { value: "AUTO", label: "Auto" },
  { value: "ON", label: "On" },
  { value: "OFF", label: "Off" },
];

interface IdeogramImageControlsProps {
  ideogram: IdeogramImageOptions;
  onIdeogramChange: (next: IdeogramImageOptions) => void;
  addedFormatPrompt: string;
  onAddedFormatChange: (v: string) => void;
  /** Shown under the “Added format prompt” label. */
  formatHint?: string | undefined;
}

export function IdeogramImageControls({
  ideogram,
  onIdeogramChange,
  addedFormatPrompt,
  onAddedFormatChange,
  formatHint,
}: IdeogramImageControlsProps) {
  const patch = (p: Partial<IdeogramImageOptions>) =>
    onIdeogramChange(mergeIdeogram(ideogram, p));

  const hasPreset = Boolean(ideogram.style_preset?.trim());
  /** Preset dropdown only usable in Auto / General (Ideogram API). */
  const presetSelectDisabled =
    ideogram.style_type === "REALISTIC" || ideogram.style_type === "DESIGN";

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
        Ideogram
      </p>

      <RadioGroup
        name="ideo-rendering"
        legend="Rendering speed"
        value={ideogram.rendering_speed}
        onChange={(rendering_speed) => patch({ rendering_speed })}
        options={RENDERING}
      />
      <RadioGroup
        name="ideo-style"
        legend="Style type"
        value={ideogram.style_type}
        onChange={(style_type) => {
          const next: Partial<IdeogramImageOptions> = { style_type };
          if (
            (style_type === "REALISTIC" || style_type === "DESIGN") &&
            ideogram.style_preset?.trim()
          ) {
            next.style_preset = "";
          }
          patch(next);
        }}
        options={STYLE}
        isOptionDisabled={(v) => hasPreset && isStyleTypeDisabledWhenPresetSelected(v)}
      />
      {hasPreset ? (
        <p className="text-[10px] leading-snug text-amber-400/70">
          With a style preset, only Auto and General apply. Realistic and Design are disabled.
        </p>
      ) : (
        <p className="text-[10px] leading-snug text-white/25">
          The live API rejects <code className="text-white/35">FICTION</code>; old saves map to General. With a
          style preset, Ideogram allows only Auto or General.
        </p>
      )}
      <RadioGroup
        name="ideo-magic"
        legend="Magic prompt"
        value={ideogram.magic_prompt}
        onChange={(magic_prompt) => patch({ magic_prompt })}
        options={MAGIC}
      />

      <div className="space-y-1">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/35">
          Style preset <span className="font-normal text-white/25">(optional)</span>
        </label>
        <select
          value={ideogram.style_preset}
          aria-describedby={presetSelectDisabled ? "ideo-preset-locked-hint" : undefined}
          title={
            presetSelectDisabled
              ? "[Auto + General Modes Only] — switch style type to Auto or General to use presets"
              : undefined
          }
          disabled={presetSelectDisabled}
          onChange={(e) => {
            const style_preset = e.target.value as IdeogramStylePresetV3;
            const next: Partial<IdeogramImageOptions> = { style_preset };
            if (
              style_preset &&
              (ideogram.style_type === "REALISTIC" || ideogram.style_type === "DESIGN")
            ) {
              next.style_type = "GENERAL";
            }
            patch(next);
          }}
          className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-amber-400/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {STYLE_PRESET_OPTIONS.map((o) => (
            <option key={o.value || "none"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {presetSelectDisabled ? (
          <p className="text-[10px] text-white/35" id="ideo-preset-locked-hint">
            [Auto + General Modes Only] — choose Auto or General above to pick a preset.
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="ideo-added-format"
          className="block text-[10px] font-bold uppercase tracking-wider text-white/35"
        >
          Added format prompt
        </label>
        {formatHint ? (
          <p className="text-[10px] leading-snug text-white/30">{formatHint}</p>
        ) : null}
        <textarea
          id="ideo-added-format"
          value={addedFormatPrompt}
          onChange={(e) => onAddedFormatChange(e.target.value)}
          rows={4}
          spellCheck={false}
          className="w-full resize-y rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs leading-relaxed text-white/85 placeholder-white/20 outline-none focus:border-amber-400/40"
          placeholder="Lighting, background, layout…"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="ideo-negative"
          className="block text-[10px] font-bold uppercase tracking-wider text-white/35"
        >
          Negative prompt <span className="font-normal text-white/25">(optional)</span>
        </label>
        <textarea
          id="ideo-negative"
          value={ideogram.negative_prompt}
          onChange={(e) => patch({ negative_prompt: e.target.value })}
          rows={2}
          spellCheck={false}
          className="w-full resize-y rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-white/80 outline-none focus:border-amber-400/40"
          placeholder="What to avoid…"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="ideo-seed"
          className="block text-[10px] font-bold uppercase tracking-wider text-white/35"
        >
          Seed <span className="font-normal text-white/25">(optional, for repeatability)</span>
        </label>
        <input
          id="ideo-seed"
          type="text"
          inputMode="numeric"
          value={ideogram.seed}
          onChange={(e) => patch({ seed: e.target.value.replace(/\D/g, "") })}
          className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-amber-400/40"
          placeholder="Leave empty for random"
        />
      </div>

      <p className="text-[10px] leading-snug text-white/25">
        Square output (<code className="text-white/40">1×1</code>) is fixed for Bluff Box cards and
        covers. <code className="text-white/35">style_codes</code> cannot be combined with{" "}
        <code className="text-white/35">style_type</code> (per API). Full reference:{" "}
        <a
          href="https://developer.ideogram.ai/api-reference/api-reference/generate-v3"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400/70 underline hover:text-amber-300"
        >
          Generate v3
        </a>
        .
      </p>
    </div>
  );
}
