import localFont from "next/font/local";

/**
 * Custom Fonts
 *
 * All self-hosted. `next/font/google` fetches from Google at BUILD time, so a
 * hiccup at fonts.googleapis.com fails the deploy with an error that points
 * at layout.tsx and looks like application code — which is exactly what took
 * down a rollout on 2026-09-24. Nothing here touches the network.
 *
 * The woff2 files live in public/fonts alongside the card fonts the JMFonts
 * registry loads at runtime, so there is one copy of each in the repo.
 *
 * JMJambo - Custom display font for titles and headers
 */

export const jmJambo = localFont({
  src: "./JMJambo.otf",
  variable: "--font-jm-jambo",
  display: "swap",
});

/** Site body font. Variable weight 400-700. */
export const crimsonPro = localFont({
  src: "../../public/fonts/crimson-pro-latin.woff2",
  variable: "--font-geist-sans",
  weight: "400 700",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

/** Everything with `font-mono`. Variable weight 400-500. */
export const jetbrainsMono = localFont({
  src: "../../public/fonts/jetbrains-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "400 500",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
