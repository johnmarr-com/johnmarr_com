> **STATUS: PARTIALLY IMPLEMENTED (spec = roadmap).** Shipped today: ScrollyFox
> docs with **Hero segments only** (split layouts, per-device layout + style
> overrides, editor at `/scrollyfox`, embeddable in CMS pages as a
> `"scrollyfox"` page segment). Everything else here — other segment types,
> dynamic/CYOA mode, media library, Brand/Brandaur — is design intent, not
> code. Implementation: `src/app/scrollyfox/`, `src/lib/scrollyfox.ts`,
> `src/lib/scrollyfox-style.ts`.

# ScrollyFox

A system for building scroll-driven web experiences ("scrolly-telling") and one-pagers from a stack of themed content blocks. Authoring produces a `.scrollyfox` file; a `ScrollyFoxReader` component unpacks and renders it live on the web.

**Primary use cases**
- Rebuild of the johnmarr.com home page
- Short-story / narrative scroll experiences
- General one-pager landing pages

---

## 1. Branding & chrome

ScrollyFox lives under the johnmarr.com umbrella but presents as its own product.

- **URL:** `johnmarr.com/scrollyfox`. `scrollyfox.com` resolves here.
- **Top-left anchor:** the **J logo**, on every ScrollyFox page and every JohnMarr app/experience. Clicking it returns to `johnmarr.com`. This is the universal umbrella mark.
- **Rest of the header:** ScrollyFox-branded — its own wordmark, navigation, and theme. Outside the J anchor, the experience looks like its own entity.
- **Authentication:** shared **SSO** across all JohnMarr apps. A user signed in on johnmarr.com is signed in on ScrollyFox (and vice versa).
- **Attribution:** "an Inventing.Studio product" lives in the **footer**, not the header. Inventing.Studio is the studio/lab grouping; it stays a quiet attribution until/unless it earns its own destination at `inventing.studio`.

**Identity hierarchy**
1. **J** — umbrella identity (always top-left).
2. **ScrollyFox** — product chrome (the experience itself).
3. **Inventing.Studio** — attribution (footer).

This pattern is intended to be reusable for every future sub-product under the JohnMarr umbrella.

---

## 2. Breakpoints

Layout and menu share the same breakpoints — no in-between zones.

| Zone    | Width range      | Layout                                  | Menu                          |
|---------|------------------|-----------------------------------------|-------------------------------|
| Desktop | `1070+`          | Up to max columns (see §3)              | Full top-bar menu             |
| Tablet  | `734 – 1069`     | Max 2 columns                           | Full top-bar menu             |
| Mobile  | `320 – 733`      | Single column, stacked                  | Simplified full-screen dropdown |

- Minimum supported width: **320px**.
- The boundary at **734** is the layout/menu switch. The "834 simplified menu" idea from Apple is dropped — menu simplifies at the Mobile boundary instead.

---

## 3. Menu System

- **Desktop / Tablet:** full top-bar menu with links.
- **Mobile:** simplified menu, expanding to a full-screen dropdown.
- Menu is authored once per ScrollyFox document and lives above the block stack.

---

## 4. Content Blocks

Blocks are the atomic unit of a ScrollyFox document. The page is a vertical stack of blocks.

### Block rules
- Every block is **full viewport width**.
- A block may optionally contain **stackable columns**.
- A block has a **theme** (selected from a defined theme set) that determines colors, typography, and spacing within the block.
- All blocks obey the global breakpoint rules below regardless of theme.

### Columns
Bootstrap-style: authored column count is the Desktop count, with automatic collapse at smaller widths.

| Authored columns | Desktop | Tablet | Mobile |
|------------------|---------|--------|--------|
| 1                | 1       | 1      | 1      |
| 2                | 2       | 2      | 1      |
| 3                | 3       | 2      | 1      |
| 4 *(max)*        | 4       | 2      | 1      |

- Maximum columns: **4** (proposal — open for revision).
- Collapse order for 3-col → 2-col tablet is TBD (likely first-row-first, second pair wraps).

### Block types
- Standard text / heading / CTA block (centered at max width 320 on mobile).
- Image + text block.
- Embedded component block — wraps existing JMKit components (e.g. the JMKit **Carousel**).
- *(more to be added as the feature grows)*

---

## 5. Images

Every image on a block declares a **mode**:

### `clip` mode
- Width and height are maintained below the 734 boundary.
- Image is **centered and clipped** to the viewport / column width.
- Use for hero / background imagery where art-direction matters more than seeing the whole frame.

### `dynamic` mode
- Image shrinks to a chosen target width, **default 320px**.
- Height is **auto** (preserves aspect ratio).
- Use for product shots, illustrations, and inline supporting imagery.

### Asset swapping
- Below 734 a block may swap to a **mobile-specific image asset** (separate file), independent of the chosen mode. Authoring should support specifying both desktop and mobile assets per image slot.

---

## 6. Content alignment (Mobile)

- Mobile text and CTAs are **centered**, constrained to **max width 320**.
- `clip` images stay at their declared width (commonly 734) and clip to the viewport.
- `dynamic` images shrink between **440 → 320**, auto height.

---

## 7. Authoring & Reader

### Authoring interface
- User configures the menu (links, labels, mobile dropdown behavior).
- User builds a vertical stack of content blocks, each with:
  - Theme
  - Column count (1–4)
  - Per-column content (text, images, embedded components)
  - Image mode(s) and mobile asset overrides
- Output: a single **`.scrollyfox`** file (format TBD — likely JSON).

### Reader
- `ScrollyFoxReader` component takes a `.scrollyfox` document and renders it live in the browser.
- All breakpoint, column-collapse, and image-mode rules are enforced by the reader, not the authoring tool — themes and content travel in the file; layout behavior is baked into the reader.

---

## 8. Component integration

ScrollyFox supports embedding existing JMKit components inside blocks. Initial set:

- **Carousel** (existing in JMKit)

Embedded components are responsible for their own internal responsive behavior but must respect the column width handed to them by the block.

---

## 9. Segments & Layout Options

A **Segment** is a content category with characteristic behavior. The system ships with 10 Segments. Each Segment offers **1–N Layout Options** — pre-fab visual arrangements with motion behavior baked in. Authors pick a Segment, then a Layout Option, then drop in content. The reader handles all responsive behavior automatically per §2.

**Composition.** Segment + Layout Option (content + motion) is orthogonal to **Brand** (color tokens + fonts — see §14 Brand Object). Any Layout Option can be dressed in any Brand.

**Automagic responsive behavior.** Every Layout Option ships with defined behavior for Desktop / Tablet / Mobile. Authors do not pick layouts per breakpoint — the system collapses, swaps, and reflows according to per-layout rules. Image modes (§5) and column rules (§4) apply automatically inside each Layout Option. Heavy motion (pinned media, scroll-driven horizontal pans, scrubbed sequences) gracefully degrades — typically to Fade Stack — when the reader detects Mobile width or `prefers-reduced-motion`.

---

### 9.1 Hero
Opening anchor block. Typically one per page; can repeat as chapter openings in narrative use.

| Layout                       | Description                                                                 |
|------------------------------|-----------------------------------------------------------------------------|
| Split, image left            | Image left; headline + subhead + CTA(s) right.                              |
| Split, image right           | Mirror of above.                                                            |
| Full-bleed background        | Image or video background; content centered or bottom-anchored.             |
| Type-on intro                | Minimal background; headline types on, CTA fades in.                        |
| Layered parallax             | Multi-layer hero with depth on scroll.                                      |

**Phase 1 scope.** Ship **Split, image left** and **Split, image right** first. The remaining three layouts come after the editor + Save-to-Templates flow is proven on the split pair.

**Split layout rendering rules** (apply to both Split, image left and Split, image right):

- **Desktop / Tablet:** two columns side-by-side. Text column carries the title + subtitle + CTA(s), vertically centered. Block height is **auto**, driven by the text column's natural content height.
- **Mobile:** stacked, **text-first** order — title → subtitle → CTAs → image at the bottom.
- **Image sizing:** *aspect-fit favoring height*. Image fills the column height with **15px insets** on all sides; width is auto from its aspect ratio. If the resulting width exceeds the column's available width, the width caps and the image is **vertically centered** within the column with the leftover space split top/bottom.
- **Brand** (§14) drives all colors and fonts.

### 9.2 Showcase
Single feature explained with imagery + text.

| Layout                       | Description                                                                 |
|------------------------------|-----------------------------------------------------------------------------|
| Image left / copy right      | Classic feature pairing.                                                    |
| Image right / copy left      | Mirror.                                                                     |
| Image above / copy below     | Vertical arrangement on every breakpoint.                                   |
| Pinned media, scrolling copy | Image pins; text scrolls past it (Apple-style explainer).                   |
| Cycling media                | Text pins; image swaps through a keyed sequence as the user scrolls.        |

### 9.3 Feature Set
Multiple parallel features. Column rules from §4 govern collapse.

| Layout         | Description                                                                       |
|----------------|-----------------------------------------------------------------------------------|
| 2-up           | Two side-by-side, equal weight.                                                   |
| 3-up           | Three columns.                                                                    |
| 4-up           | Four columns; collapses to 2 on Tablet, 1 on Mobile.                              |
| Icon rows      | Icon-left + title + body in stacked rows (mobile-native even on Desktop).         |
| Numbered steps | Same as icon rows with numbers replacing icons.                                   |

### 9.4 Quote
Pull-quote / testimonial / spotlight moment.

| Layout                  | Description                                                                |
|-------------------------|----------------------------------------------------------------------------|
| Minimal centered        | Large quote, attribution below.                                            |
| Magazine drop-cap       | Editorial vibe; oversized opening character or first word.                 |
| Two-tone split          | Quote on one half, portrait or photo on the other.                         |
| Marquee rotation        | Multiple quotes auto-rotate or scroll-step.                                |
| Stacked vertical        | Multiple quotes shown stacked, no rotation.                                |
| Letterbox over image    | Quote sits in a horizontal band over a backdrop.                           |
| Block-quote with mark   | Large opening quote glyph, indented body.                                  |

### 9.5 Gallery
Image-led grid.

| Layout            | Description                                                                  |
|-------------------|------------------------------------------------------------------------------|
| Even grid         | 2x2, 3x3, or 4x4; uniform tiles.                                             |
| Masonry           | Varied heights, packed.                                                      |
| Captioned strip   | Single row of tiles with captions below.                                     |
| Lightbox grid     | Tap a tile to open larger.                                                   |
| Polaroid scatter  | Angled tiles, playful arrangement.                                           |

### 9.6 Carousel
Horizontal pan content. Wraps the existing JMKit Carousel.

| Layout            | Description                                                                  |
|-------------------|------------------------------------------------------------------------------|
| Card carousel     | Equal-size cards with snap.                                                  |
| Full-bleed slides | One image fills width per slide.                                             |
| Peek-next         | Current card centered; neighbors peek in.                                    |
| Quote-driven      | Quote-segment content cycled through the carousel.                           |
| Logo strip        | Auto-marquee; social-proof flavor.                                           |

### 9.7 Timeline
Sequential progression / chapters / steps.

| Layout                  | Description                                                                |
|-------------------------|----------------------------------------------------------------------------|
| Vertical dots           | Left-rail dots with content to the right.                                  |
| Horizontal scroll-driven| Vertical scroll converts to horizontal pan through the timeline.           |
| Alternating sides       | Content zigzags left/right of a center spine.                              |
| Numbered cards          | Sequential numbered cards, top-to-bottom.                                  |

### 9.8 Stats
Metric or proof-point cluster.

| Layout       | Description                                                                     |
|--------------|---------------------------------------------------------------------------------|
| Stat row     | 3 metrics side-by-side; count-up animation on view.                             |
| Stat grid    | 4–6 metrics in a grid.                                                          |
| Hero number  | One giant number with caption.                                                  |
| Bar compare  | Side-by-side bar visualization.                                                 |

### 9.9 CTA
Call to action.

| Layout              | Description                                                              |
|---------------------|--------------------------------------------------------------------------|
| Centered button     | Short copy, single button.                                               |
| Banner over image   | Overlay band with CTA across an image.                                   |
| Split with form     | Copy left, signup or contact form right.                                 |
| Contrast band       | High-contrast strip across the page width.                               |
| Footer-style        | Multi-line, multiple CTAs, optional social links.                        |

### 9.10 Story Beat
Narrative pacing for scrollytales and CYOA. Pairs naturally with Dynamic mode (§10).

| Layout                     | Description                                                           |
|----------------------------|-----------------------------------------------------------------------|
| Typed prose + choices      | Text types on; choice buttons appear below.                           |
| Dialogue bubble            | Character portrait + speech bubble.                                   |
| Chapter card               | Full-bleed chapter title + subtitle.                                  |
| Inline media break         | Image or short video as a single beat.                                |
| Decision fork visualized   | Choice buttons shown as two paths with preview imagery.               |

---

### 9.11 Future: Gamified Segments
A second tier of Segments is planned for adventure-game and gamified scrollytales. These are **deferred** — the initial 10 (§9.1–9.10) ship first. Captured here so the architecture leaves room for them and so authoring/runtime state (§10) accounts for the interaction surface they need.

Planned candidates:

- **Combat** — turn-based mini-encounter (player choice of attack/defend/item, opponent response, HP & state visible).
- **Drag-and-drop Puzzle** — rearrange/sort/fit pieces into target positions; success advances the story.
- **Inventory / Item Use** — present inventory, let the user choose an item to use on the current scene.
- **Skill Check** — stat-based or dice-based check against a difficulty value (RPG-flavored).
- **Map / Navigation** — pick a destination from a visual map; choice routes the story graph.
- **Lock / Cipher** — enter a code, solve a cipher, or arrange tumblers.
- **Match / Memory** — pair-matching minigame.

All gamified Segments are first-class participants in Dynamic mode: their interactions mutate runtime state and resolve story-graph branches (§10).

---

## 10. Document modes: static & dynamic

A `.scrollyfox` document declares one of two modes:

### Static
- Block stack is fully authored at build time. Order and content are fixed.
- Used for marketing pages, the johnmarr.com home, and other one-pagers.

### Dynamic
- Block stack **mutates at runtime** in response to user input.
- New blocks **append below** the current position. The user scrolls up to read history — like a chat or journal.
- Past blocks become **read-only** once the user has moved past a decision; they're locked into the transcript.
- Used for choose-your-own-adventure (CYOA) and other interactive scrollytales.

### Interactions
Blocks may declare **interactions** — choice buttons, inputs, or other controls. In Dynamic mode, an interaction resolves to the **next block(s) to append**. In Static mode, interactions may still exist (e.g. a CTA link), but they do not mutate the stack.

### Story graph & state (Dynamic only)
- A **story graph** connects authored block templates by id. Each interaction names the next node (or a branch resolver).
- A **runtime state** object tracks: current position, choice history, and arbitrary author-defined variables (flags, inventory, scores, names).
- Branch resolution can be deterministic (choice → next id) or state-conditional (choice + state → next id).

### Hybrid is allowed
A document can be mostly static (home-page chrome, intro) with a dynamic section embedded inside. The mode is per-document, but a static document may contain bounded interactive regions whose mutations stay scoped within their own sub-stack.

---

## 11. UI surfaces

ScrollyFox ships with four primary UI surfaces inside johnmarr.com.

### 11.1 ScrollyFox Home (`/scrollyfox`)
Landing page for ScrollyFox.

- **J anchor** top-left (per §1) — returns to johnmarr.com.
- **Animating ScrollyFox logo** top-right.
- **Grid** of the signed-in user's ScrollyFoxes. Each card shows name, slug, and a thumbnail (default: first segment's primary image).
- **Empty state:** a single large **+ Create your first ScrollyFox** button.
- **Persistent + Create** affordance when the grid has content (trailing card or floating action — TBD).
- Tapping a card opens the **ScrollyFox Editor** (§11.3).

### 11.2 Segment Selector
Modal/screen invoked from the Editor's "+ add segment" button.

- **Device-mode toggle**, capped by the user's actual device:
  - On Desktop: Desktop / Tablet / Mobile.
  - On Tablet: Tablet / Mobile.
  - On Mobile: Mobile only.
- **Vertical scroller** — one row per Segment (10 rows: Hero, Showcase, Feature Set, Quote, Gallery, Carousel, Timeline, Stats, CTA, Story Beat).
- **Horizontal scroller within each row** — that Segment's Layout Options, each rendered at actual viewport size for the selected device mode, using default example content.
- Tapping a Layout Option → **confirmation** → loads into Segment Editor (§11.4).
- **Every Segment × Layout Option ships with a default example** (default images + placeholder copy) so authors see what they're picking and have a starting point to edit.

### 11.3 ScrollyFox Editor / Viewer
The per-ScrollyFox screen.

- **Top: editor controls** — Name field (unique slug → `johnmarr.com/scrollyfox/{name}`); device-mode toggle for the preview below.
- **Body: live stack** of the ScrollyFox's segments, rendered in the selected device mode. The reader's actual responsive behavior is in effect — you see the real thing.
- **Per-segment overlay** (shown in edit mode):
  - **Top-left:** drag handle for vertical reorder.
  - **Top-right:** edit / delete icon.
- **Segments carry an index ID** that determines vertical order; drag updates the index.
- **Bottom of stack:** + Add segment button → Segment Selector.
- **Exit** returns to ScrollyFox Home.

### 11.4 Segment Editor
Invoked when a Layout Option is picked, or when an existing segment's edit icon is tapped.

- **Top: input panel** — all editable fields for the selected Layout Option:
  - Image swap (with preview) per image slot, including mobile-asset override (§5).
  - Title, subtitle, body text inputs.
  - **CTA list** — each CTA has a label and a **destination**: a URL or an in-game action (Dynamic mode, §10). "Add CTA" allows multiple.
  - Layout-specific extras (e.g., column count for Feature Set, layout-flip toggle where applicable).
- **Bottom: live preview** of the segment with edits applied, in the selected device mode.
- **Save** writes the segment back into the stack at its index.

### 11.5 URL scheme

- Each ScrollyFox has a unique slug.
- Live URL: `johnmarr.com/scrollyfox/{name}`.
- `scrollyfox.com/{name}` resolves to the same.
- **Future:** a ScrollyFox may opt into a dedicated `scrollyfox.com/{name}` URL with no johnmarr in the visible path, while continuing to live on the johnmarr platform.

---

## 12. Media Library

A per-user shared library of uploaded assets. Each asset is **stored once and referenced by ID** from every segment image slot — no duplicate copies of the same image across a user's ScrollyFoxes.

### 12.1 Per-user scope
- Each authenticated user has their own library.
- All of that user's ScrollyFoxes draw from the same library.
- Library lives behind the shared JohnMarr SSO (§1) and could plausibly graduate to a platform-level service for all JohnMarr apps — see open questions.

### 12.2 Picker UX
When an image slot is tapped in the Segment Editor (§11.4):

- Show a grid of the user's library (with search / tag filter).
- **Upload new** — adds a fresh asset to the library and selects it.
- **Use existing** — picks an asset already in the library.
- **Keep system default** — leaves the seeded example image in place (see §12.4).

### 12.3 Replace semantics
- A user can **replace an existing library asset with a new version**. The asset ID is preserved; every segment that references it updates automatically.
- The picker should surface this cascading effect explicitly (e.g., "This image is used in N segments across M ScrollyFoxes — replace everywhere?") so the user doesn't accidentally mass-edit content.

### 12.4 System default assets
The 50 Segment × Layout Option examples (§11.2) draw from a separate **system-owned default asset pool**. New segments reference these defaults (not copies) until the author replaces them, keeping a fresh ScrollyFox lightweight and the user's library clean.

### 12.5 Mobile asset override
A single library asset can carry both **desktop and mobile variants** (§5). The picker treats them as one asset with two upload slots. Replacing either variant follows §12.3 semantics.

### 12.6 Metadata
Each library asset carries: filename, dimensions, alt text, optional tags. Replace-version preserves the ID; alt and tags carry over by default and can be edited.

### 12.7 Orphans
Assets that become unreferenced (e.g., after segment deletion) remain in the library until manually purged. Automatic cleanup is **not** the default — orphans are common during editing and the user should decide. The library UI shows a usage count per asset to help.

---

## 13. Foundations & open-source

ScrollyFox is positioned as **Carrd-with-motion-and-narrative**: Carrd.co is the strongest comparable for one-pager template authoring; ScrollyFox extends that surface into scrollytelling, branching CYOA, and gamified beats. Several open-source libraries cover meaningful chunks of the underlying mechanics.

### 13.1 Recommended stack (use)

| Library | License | Role in ScrollyFox |
|---|---|---|
| **Puck** (`measuredco/puck`) | MIT | Closest fit for the editor. Config-driven React visual builder: blocks + fields → drag-reorder, live preview, JSON save format, same components rendered in production. The Segment Editor (§11.4) and per-ScrollyFox stack (§11.3) are essentially a Puck instance. |
| **Scrollama** | MIT | Lightweight scroll-step triggers (NYT/Pudding-grade scrollytelling). Powers "as user scrolls past beat N" behavior in Story Beat, Pin & Reveal, Cycling Media. |
| **GSAP + ScrollTrigger** | No-charge under Webflow (verify current license terms before commit) | Heavy scroll-driven motion: pinning, scrubbing, layered parallax, type-on. Pairs with Scrollama for triggers. |
| **inkjs / Ink** | MIT | Branching-narrative engine with variables, knots, weighted choices. Strong candidate to be the story-graph runtime in Dynamic mode (§10) rather than rolling our own. Authoring stays ScrollyFox-native and compiles to ink under the hood. |

### 13.2 Optional / future

| Library | Use case |
|---|---|
| **Twine** | Likely **import path** for authors who already write CYOAs there. Not a runtime dependency. |
| **Framer Motion** | Lighter-weight React-native alternative if GSAP's footprint or license terms become a problem. Less powerful for scroll-pin/scrub. |
| **Lenis** / **Locomotive Scroll** | Smooth-scroll layer; consider only if native scroll feel becomes a bottleneck for the heavy motion segments. |

### 13.3 What stays custom

No good OSS substitute exists for these — they are ScrollyFox-specific and must be built:

- **Segment Selector** with device-mode toggle and horizontal Layout-Option scroller per row (§11.2). Bespoke UX.
- **Media Library** with cross-segment replace-with-cascading semantics (§12). Puck's field system gives per-field uploaders only.
- **ScrollyFox Home grid** and a Carrd-style template gallery for one-pagers (§11.1).
- **Theme system** — visual tokens applied across blocks, orthogonal to Segment/Layout (§9).
- **JohnMarr SSO integration** and the J-anchor chrome contract (§1).
- The 50 default Segment × Layout examples seeded from the system asset pool (§12.4).

### 13.4 Build / buy / borrow summary

- **Borrow:** Puck (editor), Scrollama (triggers), GSAP (motion), inkjs (story graph).
- **Build:** Segments × Layout Options as Puck components, Media Library, Segment Selector, Home, Theme system, SSO + chrome.
- **Buy:** none planned — the OSS stack covers the commercial-grade pieces (motion, branching) we'd otherwise pay for.

---

## 14. Brand Object

A **Brand Object** is the cross-app source of visual identity — colors and fonts — applied to ScrollyFox content. It is **separate from JMStyle**, which dresses the johnmarr.com app chrome (J anchor, header, page frame). JMStyle stays consistent across the umbrella; Brand changes per ScrollyFox.

### 14.1 Shape

```ts
interface BrandObject {
  colors: {
    primary: string;     // Headlines, primary CTA, key accents
    secondary: string;   // Supporting accents, secondary CTA
    tertiary: string;    // Sparing accent, highlights
    bgPrimary: string;   // Most segment backgrounds
    bgSecondary: string; // Alternating sections, cards on primary bg
  };
  fonts: {
    title: string;  // Headings, short emphasis
    body:  string;  // Subtitles, paragraphs, button labels
  };
}
```

### 14.2 Cross-app ownership: Brandaur
The Brand Object is owned by a sibling app, **Brandaur**, which provides the authoring UI for creating, editing, and managing brands across the JohnMarr universe. ScrollyFox **consumes** Brand Objects; it does not own them.

Brandaur lives under the same Inventing.Studio umbrella as ScrollyFox and ships later. Until it does:

- ScrollyFox includes a hardcoded **default Brand** approximated from the johnmarr.com palette (`src/lib/brand`).
- Segments accept a `brand: BrandObject` prop; the default is supplied at the document/page level and inherited downward.
- When Brandaur ships, the default falls back to "the first Brand the user authored," and the editor adds a Brand picker per ScrollyFox.

### 14.3 Mapping to segments
Segment Layout Options consume Brand tokens in defined slots — for example, Hero's Split layouts use `colors.primary` for the title and primary CTA border, `colors.secondary` for the subtitle, `colors.tertiary` for additional CTAs, `colors.bgPrimary` for the text column, `colors.bgSecondary` for the image column, `fonts.title` on the headline, `fonts.body` everywhere else. Each Layout Option's spec declares its slot mapping explicitly; authors do not pick which token goes where.

---

## 15. Open questions / TBD

- Final column max (4 vs. higher).
- 3-column tablet collapse order.
- `.scrollyfox` file format (JSON shape, versioning).
- Theme catalog — initial set and whether themes are per-block only or can be page-level defaults.
- Authoring UI surface (in-app route, separate tool, etc.).
- Segments & Layout Options catalog — is the initial set locked, or extensible? Plugin model for community-contributed Layout Options?
- Mobile fallback policy — per-layout override vs. global reader rule.
- Gamified Segments (§9.11) — full spec, including required runtime state primitives (HP, inventory, dice, timers) and reusable UI affordances (buttons, drag targets, input fields).
- Story-graph file format — separate file, embedded in `.scrollyfox`, or both supported?
- Runtime state schema — typed (author declares variable shape) vs. freeform bag.
- Persistence of dynamic-mode progress — local-only, signed-in (via JohnMarr SSO), or shareable replay links.
- ScrollyFox Home card thumbnail rule — first-segment image vs. author-uploaded cover image.
- "Persistent + Create" affordance on Home — trailing card in the grid vs. floating action button.
- Edit-mode vs. View-mode toggle in the per-ScrollyFox screen — always-edit vs. switchable clean preview.
- Slug rules — allowed characters, length, collision policy across users, reserved words.
- Reorder UX on Mobile — drag-handle only vs. also up/down buttons.
- Media Library scope — ScrollyFox-only vs. JohnMarr-platform-shared service used by every JohnMarr app.
- Image transcoding — auto-generate responsive variants on upload, or rely solely on author-supplied desktop/mobile assets.
- Per-user library quota / storage limits.
- System default asset pool location — dedicated Firebase Storage bucket vs. in-repo public assets.
