# Feature Banner Carousel

A complete, self-contained banner carousel extracted from **johnmarr.com**: the
coverflow hero you see at the top of the home page, plus the whole admin surface
that creates, orders, styles and saves the banners it renders.

Drop the `src/` folder into any **React 18/19** app. Nothing here imports from
the host application.

---

## 1. What this is built on

| Concern | Choice |
| --- | --- |
| **Carousel engine (third party)** | **[Swiper](https://swiperjs.com) v12** — `swiper/react`, using the `EffectCoverflow` and `Autoplay` modules |
| Styling | Plain CSS files shipped with the components. **No Tailwind, no CSS-in-JS, no styled-jsx.** |
| Icons | Inline SVG. **No icon library.** |
| Images | A plain `<img>` by default; `next/image` (or any CDN component) is injectable |
| Persistence | Anything — behind a `BannerStore` interface. A Firebase (Firestore + Storage) adapter is included |

**Swiper is the only runtime dependency of the renderer.** `firebase` /
`firebase-admin` are needed *only* if you use the included storage adapters.

### Why Swiper and not Embla / Keen / hand-rolled

The banner needs four things at once, and Swiper is the only mainstream option
that gives all four out of the box:

1. **`slidesPerView: "auto"`** — slide width comes from CSS, which is what makes
   the responsive sizing in §3 possible without JS measurement.
2. **Coverflow with `modifier`** — the neighbouring banners peek in from both
   sides and scale back, which is the entire visual identity of the component.
3. **True infinite `loop`** with a stable `realIndex`, so the pagination dots
   keep pointing at the right banner forever.
4. **Autoplay with `pauseOnMouseEnter`**, plus imperative `slidePrev` /
   `slideNext` / `slideToLoop` for custom controls.

Swiper is framework-agnostic, ships its own React bindings, and has no peer
dependencies of its own.

---

## 2. Install and wire up

### 2.1 Dependencies

```bash
npm install swiper
# only if you use the included Firebase adapters:
npm install firebase firebase-admin
```

### 2.2 Copy the folder

Copy `carousel/src/` into your app, e.g. `src/carousel/`. If you are **not** on
Firebase, **delete `src/data/`** — nothing else imports it.

```
carousel/
├── README.md                  ← this file
├── rules/
│   ├── firestore.rules.snippet
│   ├── storage.rules.snippet
│   └── firestore.indexes.snippet.json
└── src/
    ├── index.ts               barrel export
    ├── types.ts               BannerRecord / FeaturedItem / BannerStore
    ├── theme.ts               12 color tokens, all overridable
    ├── button-styles.ts       CTA pill styles: built-ins + resolver
    ├── banners.ts             stored banner → renderable slide
    ├── FeaturedCarousel.tsx   ★ the renderer
    ├── carousel.css           ★ the entire sizing model (read the header)
    ├── admin/
    │   ├── BannerManager.tsx  ★ the authoring panel
    │   ├── ButtonStylePicker.tsx
    │   ├── ImageUpload.tsx
    │   └── admin.css
    └── data/
        ├── firebase-store.ts  BannerStore over Firestore + Storage (client)
        └── firebase-server.ts server-side read via firebase-admin
```

### 2.3 Render it

```tsx
"use client";
import { FeaturedCarousel } from "@/carousel";
import type { FeaturedItem } from "@/carousel";

const items: FeaturedItem[] = [
  {
    id: "1",
    title: "Boaty McBoatface",
    subtitle: "New this week",
    description: "Name the boat. Defend the name. Lose anyway.",
    backdropURL: "https://…/boaty-16x9.jpg",
    href: "/games/boaty",
    ctaLabel: "Play",
  },
];

export function Hero() {
  return <FeaturedCarousel items={items} />;
}
```

That is a working carousel. Everything below is configuration.

> **Next.js App Router:** `FeaturedCarousel` and `BannerManager` are client
> components (`"use client"` is already in the files). Fetch the banners in a
> server component and pass them down as props — see §6.

---

## 3. The banner element, and how it sizes itself

This is the part worth understanding. **There is not a single fixed pixel height
anywhere in the component.** Read `src/carousel.css` alongside this section; its
header comment is the canonical explanation.

### The four-step model

**Step 1 — hand sizing to CSS.**
Swiper runs with `slidesPerView="auto"` and `centeredSlides`. In that mode
Swiper *reads* each slide's width from the stylesheet instead of dividing the
track into N equal columns. Layout therefore becomes a pure CSS problem, which
means media queries work, there is no resize listener, and there is no flash of
a wrongly-sized slide on first paint.

**Step 2 — width is a percentage, stepped at three breakpoints.**

```css
.jmc-slide            { width: var(--jmc-w-mobile)  !important; } /* 85% */
@media (min-width: 640px)  { .jmc-slide { width: var(--jmc-w-tablet)  !important; } } /* 75% */
@media (min-width: 768px)  { .jmc-slide { width: var(--jmc-w-laptop)  !important; } } /* 65% */
@media (min-width: 1024px) { .jmc-slide { width: var(--jmc-w-desktop) !important; } } /* 60% */
```

| Device | Viewport | Slide width | Why |
| --- | --- | --- | --- |
| Phone | < 640px | **85%** | Nearly full-bleed — the banner must stay readable. The 15% left over is what reveals the neighbours and signals "swipe me". |
| Tablet | 640–767px | **75%** | Neighbours become genuinely visible. |
| Laptop | 768–1023px | **65%** | Full coverflow depth on both sides. |
| Desktop | ≥ 1024px | **60%** | Capped by `--jmc-max-width: 900px` so the banner never becomes an unreadable billboard on a 4K monitor. |

`!important` is required: Swiper writes an inline `width` on slides in some
modes, and the media queries must win.

**Step 3 — height is derived, never declared.**

```css
.jmc-frame { aspect-ratio: var(--jmc-aspect); /* 16 / 9 */ width: 100%; }
```

Because width is already responsive and the aspect ratio is fixed, **height
follows automatically at every viewport size.** This is why there is no
breakpoint for height, no `padding-bottom: 56.25%` hack, and no JS. The backdrop
is `position: absolute; inset: 0; object-fit: cover`, so it fills and crops
rather than letterboxing.

**Step 4 — the overlay scales continuously with `clamp()`.**
Type and padding are fluid rather than stepped, so the text tracks the frame
smoothly instead of jumping at each breakpoint:

```css
.jmc-overlay     { padding: clamp(0.75rem, 2.4vw, 2rem); }
.jmc-title       { font-size: clamp(1rem, 3.2vw, 2rem); }
.jmc-description { font-size: clamp(0.75rem, 1.5vw, 1rem); -webkit-line-clamp: 2; }
.jmc-cta         { font-size: clamp(0.75rem, 1.3vw, 0.875rem); }
```

The description is clamped to two lines at every size, so a long blurb can never
push the CTA off the banner.

### Measured vs. laid-out width

Coverflow applies a `translateZ` (that is what `depth: 100` means) under a
perspective, so the *painted* banner is a uniform ~70.6% of its laid-out width
at every breakpoint. `offsetWidth` reports the real CSS width (85/75/65/60%);
`getBoundingClientRect().width` reports the post-transform one. Nothing is
broken if those two disagree — measure with `offsetWidth`. Verified in a
browser at 500 / 700 / 800 / 1440px: 85.0% / 75.0% / 65.0% / 60.0%, aspect
1.778 throughout.

### Everything is a CSS custom property

The component writes the tunables onto `.jmc-root` as inline custom properties,
so each instance can be sized differently without forking the stylesheet:

```tsx
<FeaturedCarousel
  items={items}
  slideWidths={{ mobile: "92%", tablet: "80%", laptop: "70%", desktop: "55%" }}
  aspect="21 / 9"       // cinematic instead of 16:9
  maxWidth="1200px"
/>
```

| Property | Prop | Default |
| --- | --- | --- |
| `--jmc-w-mobile/tablet/laptop/desktop` | `slideWidths` | 85% / 75% / 65% / 60% |
| `--jmc-max-width` | `maxWidth` | `900px` |
| `--jmc-aspect` | `aspect` | `16 / 9` |
| `--jmc-dot` | `dotColor` | theme accent |
| `--jmc-text`, `--jmc-text-dim`, `--jmc-arrow-bg` | `theme` | see `theme.ts` |

### The rest of the responsive behaviour

- **Arrows** are `display: none` below 640px — on touch, swiping *is* the
  control — and fade in on hover (or keyboard focus) above it.
- **Dots** are always visible, sized with `clamp()`; the active dot widens from
  6px to 16px.
- **`sizes`** is generated from the same numbers as the CSS
  (`(max-width: 640px) 85vw, (max-width: 768px) 75vw, …`) and passed to the
  image component, so the browser downloads a source matching the rendered
  width. Change `slideWidths` and `sizes` follows automatically.
- **`prefers-reduced-motion: reduce`** disables every transition.
- **Fewer than 5 banners:** coverflow looping needs slides on both sides of the
  centre one, so the list is internally repeated until there are at least five.
  Dots and click callbacks still address the real items.

### Using `next/image` instead of `<img>`

```tsx
import NextImage from "next/image";
import { FeaturedCarousel, type BannerImageProps } from "@/carousel";

const NextImageBanner = ({ src, alt, className, sizes, priority }: BannerImageProps) => (
  <NextImage src={src} alt={alt} className={className} sizes={sizes} priority={priority} fill />
);

<FeaturedCarousel items={items} imageComponent={NextImageBanner} />
```

`.jmc-image` already applies `position:absolute; inset:0; object-fit:cover`, and
the CSS also targets a bare `.jmc-frame img`, so `fill` composes correctly.

---

## 4. The control elements — creating and saving feature banners

`<BannerManager />` is the entire authoring surface. One component, one prop.

```tsx
"use client";
import { BannerManager } from "@/carousel";
import { createFirebaseBannerStore } from "@/carousel/data/firebase-store";
import { firebaseApp } from "@/lib/firebase";

const store = createFirebaseBannerStore({ app: firebaseApp });

export default function AdminBannersPage() {
  return <BannerManager store={store} />;
}
```

Gate that route behind your own admin check — the component does no auth of its
own (deliberately: it has no idea what your auth looks like).

### What the panel gives an editor

**Carousel bar**
- **Carousel** dropdown — `Default` plus every named carousel. The default
  carousel is the implicit one: banners with no `carouselId`. Named carousels
  let you place a different banner set on a different page.
- **+ New / Rename / Delete** — delete removes only the carousel; its banners
  keep their data and become unassigned.
- **Dots** colour picker — per-carousel pagination colour, saved immediately.
- **Autoplay ms** — per-carousel autoplay delay; `0` disables autoplay.

**Banner list** — one row per banner:
- **Drag handle (⠿)** — HTML5 drag to reorder. Dropping writes the new `order`
  to every affected banner in a single batch.
- **16:9 thumbnail**, title, description, and the position number.
- **◉ / ○** — show/hide. A hidden banner keeps all its data and simply stops
  being rendered (`isActive: false`). This is how you stage a banner before a
  launch, and how you retire one without losing it.
- **✎ Edit**, **🗑 Delete**.

**Editor modal** — title, subtitle, description, link (`href`), button label,
backdrop upload, and CTA button style.

**Preview** — toggles a live `<FeaturedCarousel>` rendered from the current
banners, using the real component. What you see is what ships.

### Creating a banner: the flow

Pressing **+ Add banner** creates the document *immediately*, hidden
(`isActive: false`, title `"Untitled banner"`), and then opens the editor. This
is intentional: the backdrop upload path is
`featured-backdrops/{bannerId}/backdrop.{ext}`, so the banner needs an id before
an image can be attached. The banner is invisible to the public until the editor
flips it on.

### Backdrop upload

`<ImageUpload>` handles drag-and-drop or click-to-pick, then **downscales the
image through a `<canvas>` to 1920px wide (90% JPEG) before uploading** — never
upscaling. A 4000px hero looks identical on screen and costs every visitor the
difference. Override with `maxBackdropWidth`.

The upload path is stable per banner, so a re-upload overwrites the old file;
the adapter appends a `&t={timestamp}` cache-buster to the returned URL.

### CTA button styles

A banner stores a style **id**, not colours, so retuning a style updates every
banner that uses it.

| id | Result |
| --- | --- |
| `""` or `"pink-purple"` | Built-in default — `#FF36AB → #8B35FF`, white label |
| `"gold"` | Built-in — solid `#FFD700`, black label |
| anything else | A document id in the `buttonStyles` collection |

`<ButtonStylePicker>` lists both built-ins plus every saved style, shows a live
swatch, and has an inline **+ New style** form (from / to / text colour, angle,
live preview) that saves a new style and selects it. The built-ins are plain
constants in `button-styles.ts` — no database read is needed to resolve them.

### Theming the whole thing

Both components take a `theme` prop — a partial of the eleven tokens in
`theme.ts`. Anything you omit falls back to johnmarr.com's dark palette.

```tsx
const brand = { base: "#0B0B12", accent: "#3DDC97", accentAlt: "#FFD166" };
<FeaturedCarousel items={items} theme={brand} />
<BannerManager store={store} theme={brand} />
```

---

## 5. Data model

### `BannerRecord` — collection `featured`

| Field | Type | Notes |
| --- | --- | --- |
| `carouselId` | `string?` | Owning carousel. Absent/`""` ⇒ the default carousel |
| `title` | `string` | |
| `subtitle` | `string?` | Small uppercase line above the copy |
| `description` | `string?` | Clamped to two lines when rendered |
| `backdropURL` | `string` | 16:9 image |
| `href` | `string?` | Click target |
| `contentId` / `contentType` / `slug` | `string?` | Optional link back to your own content model |
| `ctaLabel` | `string?` | Falls back to the carousel's `ctaLabel` prop, then `"View"` |
| `ctaButtonStyleId` | `string?` | See the table above |
| `order` | `number` | Ascending |
| `isActive` | `boolean` | Hidden banners are stored but never rendered |

### `CarouselRecord` — collection `featuredCarousels`
`{ name, dotColor?, autoplayDelay? }`

### `ButtonStyleRecord` — collection `buttonStyles`
`{ name, from, to, angle?, textColor }`

All three collection names are overridable via `createFirebaseBannerStore({
collections: { banners, carousels, buttonStyles } })`.

### `FeaturedItem` — the render shape

What the carousel actually consumes. Identical to `BannerRecord` minus
`order` / `isActive` / `carouselId` / `ctaButtonStyleId`, **plus a resolved
`ctaButton: { from, to, angle, textColor }`.** Convert with
`resolveBanners(records, styles, carouselId)` from `banners.ts`.

---

## 6. Reading banners for the public page

**Read on the server, not in the browser.** The Admin SDK talks plain HTTPS,
so the page can be server-rendered and cached, and the client never opens a
Firestore realtime stream for content that does not vary per user. (On
johnmarr.com that stream was also what wedged the home banner on iOS.)

```tsx
// app/page.tsx — a server component
import { getCarousel } from "@/carousel/data/firebase-server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Hero } from "./Hero";

export const revalidate = 60;

export default async function HomePage() {
  const { items, dotColor, autoplayDelay } = await getCarousel(getAdminFirestore(), "");
  return <Hero items={items} dotColor={dotColor} autoplayDelay={autoplayDelay} />;
}
```

```tsx
// app/Hero.tsx — the client boundary
"use client";
import { useRouter } from "next/navigation";
import { FeaturedCarousel, type FeaturedItem } from "@/carousel";

export function Hero({ items, dotColor, autoplayDelay }: {
  items: FeaturedItem[]; dotColor?: string; autoplayDelay?: number;
}) {
  const router = useRouter();
  return (
    <FeaturedCarousel
      items={items}
      onItemClick={(item) => item.href && router.push(item.href)}
      {...(dotColor ? { dotColor } : {})}
      {...(autoplayDelay !== undefined ? { autoplayDelay } : {})}
    />
  );
}
```

`getCarousel(db, carouselId)` returns `{ items, dotColor?, autoplayDelay? }`
with every CTA colour already resolved to hex — including saved styles, fetched
once per request and cached for the rest of it. `getCarouselItems(db, id)`
returns just the items.

Without a server, use the client store instead:

```ts
const [records, styles] = await Promise.all([
  store.listBanners(""), store.listButtonStyles(),
]);
const items = resolveBanners(records, styles, "");
```

### Not using Firebase?

Implement the `BannerStore` interface in `types.ts` — thirteen methods over your
own API — and pass it to `<BannerManager store={…} />`. The admin UI contains
no backend-specific code. `resolveBanners()` then turns whatever you load into
render-ready items.

---

## 7. Security rules and indexes (Firebase only)

Paste the snippets in `rules/`:

- `firestore.rules.snippet` — public read of **visible** banners; admin-only for
  everything else.
- `storage.rules.snippet` — public read of backdrops; admin-only image writes
  under 10MB.
- `firestore.indexes.snippet.json` — the composite index for the server
  reader's `where("isActive","==",true).orderBy("order")` query. **Deploy this
  or that query fails at runtime.**

`featuredCarousels` and `buttonStyles` are admin-read-only on purpose: the
public path resolves them server-side with the Admin SDK, which bypasses rules.

---

## 8. `<FeaturedCarousel>` props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items` | `FeaturedItem[]` | — | Renders `null` when empty |
| `onItemClick` | `(item) => void` | — | Omit to navigate via `item.href` |
| `autoplayDelay` | `number` | `6000` | ms; `0` disables autoplay |
| `dotColor` | `string` | theme accent | Active dot colour |
| `theme` | `Partial<CarouselTheme>` | dark palette | |
| `slideWidths` | `Partial<SlideWidths>` | 85/75/65/60 % | Per breakpoint |
| `aspect` | `string` | `"16 / 9"` | Any CSS `aspect-ratio` |
| `maxWidth` | `string` | `"900px"` | Slide width cap |
| `showArrows` / `showDots` | `boolean` | `true` | |
| `showTitle` / `showSubtitle` | `boolean` | `true` | |
| `ctaLabel` | `string` | `"View"` | Fallback label |
| `imageComponent` | `BannerImageComponent` | plain `<img>` | |
| `className` | `string` | — | Appended to `.jmc-root` |

**Behaviour:** autoplay pauses on hover and resumes on leave; the frame is
keyboard-activatable (Enter/Space) and only the active slide is focusable;
inactive slides are dimmed with `filter: brightness(0.35)` rather than opacity,
so the coverflow keeps its depth.

---

## 9. Differences from johnmarr.com

The extraction is behaviourally faithful; these are the deliberate changes that
make it portable.

| johnmarr.com | Here |
| --- | --- |
| Tailwind utility classes | `carousel.css` / `admin.css` |
| `styled-jsx` `<style jsx global>` for slide widths | Real CSS with custom properties |
| `lucide-react` icons | Inline SVG |
| `next/image` (required) | Plain `<img>`, `next/image` injectable |
| `useJMStyle()` theme context | `theme` prop with defaults |
| `useAuth()` for `creatorId` | Dropped — add it in your store adapter if you want it |
| Breakpoint-stepped Tailwind text sizes | Fluid `clamp()` |
| Title not rendered on the banner | Title and subtitle rendered (`showTitle` / `showSubtitle` to disable) |
| Banners must point at an existing content record | Free-form `href`; `contentId`/`contentType` optional |
| Autoplay delay hard-coded per call site | Stored per carousel and editable in the admin |
| Firestore/Storage calls inline in the components | Behind the `BannerStore` interface |
| `Navigation` Swiper module imported but unused | Dropped (custom arrows call `slidePrev`/`slideNext`) |

---

## 10. Gotchas

1. **Deploy the composite index** (§7) or the server read throws.
2. **`!important` on `.jmc-slide` width is load-bearing.** Swiper writes inline
   widths; removing it collapses every slide.
3. **Backdrops must be 16:9** (or match your `aspect`). `object-fit: cover`
   crops anything else, usually through someone's face.
4. **The `carouselId` filter runs in memory, not in the query.** Firestore
   cannot `where` on an absent field, and an absent `carouselId` is exactly what
   marks the default carousel. Fine for tens or hundreds of banners; if you get
   to thousands, backfill `carouselId: ""` onto every doc and add it to the
   query.
5. **Swiper CSS must be imported.** `FeaturedCarousel.tsx` already imports
   `swiper/css` and `swiper/css/effect-coverflow`. Don't strip them.
6. **`BannerManager` does no auth.** Gate the route yourself; the rules are the
   real enforcement.
7. **Adding a banner writes a document immediately** (hidden). Abandoned
   "Untitled banner" rows are expected — they're invisible to the public, and
   deleting them is one click.
