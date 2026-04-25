# User Levels

The app has 10 user levels. Players advance based on accumulated points. The
same level roster is used for AI persona difficulty (see
`src/app/games/_gamecore/aiPersonas.ts` → `aiEngineTierForLevel()`).

Source of truth for name / icon / min-points is the Firestore `/levels`
collection (see `src/lib/levels.ts` → `getAllLevels()`). This table mirrors
that data for reference and defines the **palette** used for visual tint in
components that display level groups (e.g. `AIPersonaGrid`).

## Roster

| # | Name | Color hint (English) | Hex | Rationale |
|---|------|----------------------|-----|-----------|
| 1 | Noob | Light gray | `#a8aeb5` | Plain, unformed — no identity yet. |
| 2 | Explorer | White | `#f3f4f6` | Clean slate, curious, heading out. |
| 3 | Enthusiast | Gunmetal blue | `#3e4a5e` | Serious steel — committed but not finished. |
| 4 | Adventurer | Sage green | `#7b9068` | Out in the wild. Natural, grounded. |
| 5 | ThrillSeeker | Pale red / black | `#3a1a1a` | Danger-adjacent. Edge of the map. |
| 6 | Wildling | Fiery orange-yellow | `#d97706` | Feral, burning, untamed. |
| 7 | Champion | Purple & white | `#8b5cf6` | Royal. Distinguished triumph. |
| 8 | Legend | Gold & black | `#3a2c08` | Darker, heavier gold. Mythic. |
| 9 | Icon | Pale yellow + flame blue | `#2a5782` | Distinguished. Cool, luminous. |
| 10 | Game Master | Black | `#0f0f0f` | Absolute top. Void. Finality. |

## Implementation

Colors are exported from `src/lib/level-colors.ts` as:

- `LEVEL_COLOR_HEX` — `Record<number, string>` hex strings.
- `levelBgStyle(level, alpha)` — returns an inline style `{ backgroundColor: rgba(...)}` for subtle tinting of containers (default alpha is low so foreground content stays readable).

Consumers: `AIPersonaGrid` uses `levelBgStyle(level, 0.18)` for each level card.

## Adding a new level

When adding L11+ to Firestore:

1. Add an entry to the `/levels` collection (title, icon, minPoints).
2. Add the color to `LEVEL_COLOR_HEX` in `src/lib/level-colors.ts`.
3. Update this file.

Omitting step 2 falls back to the neutral `bg-white/3` tint (transparent).
