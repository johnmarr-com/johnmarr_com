"use client";

/**
 * JMTeamLogoPicker — Full-screen modal grid of all available team logos.
 *
 * Shows every team icon from the shared pool, tinted with the given team
 * color. Selecting one calls `onSelect` with the chosen TeamIdentity and
 * closes the modal.
 */

import { createPortal } from "react-dom";
import { TEAM_NAMES, getTeamLogoUrl } from "@/app/games/_gamecore/teams";
import type { TeamIdentity, TeamName } from "@/app/games/_gamecore";
import { JMCloseCircleButton } from "./JMCloseCircleButton";

export interface JMTeamLogoPickerProps {
  /** Team color hex — used to tint all icons in the grid */
  color: string;
  /** Currently selected team name (highlighted in the grid) */
  currentName?: TeamName;
  /** Called when the user picks a team icon */
  onSelect: (team: TeamIdentity) => void;
  /** Called when the modal is dismissed */
  onClose: () => void;
}

export function JMTeamLogoPicker({
  color,
  currentName,
  onSelect,
  onClose,
}: JMTeamLogoPickerProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="scrollbar-none relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-neutral-950 p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Choose Team</h3>
          <JMCloseCircleButton onClick={onClose} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {TEAM_NAMES.map((name) => {
            const url = getTeamLogoUrl(name);
            const isActive = currentName === name;
            return (
              <button
                key={name}
                type="button"
                className={`relative aspect-square overflow-hidden rounded-full border-2 transition-transform active:scale-90 ${
                  isActive ? "border-white ring-2 ring-white/40" : "border-transparent"
                }`}
                style={{ backgroundColor: `${color}20` }}
                onClick={() => onSelect({ name, logoUrl: url })}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${url})` }}
                />
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: color, mixBlendMode: "color" }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
