import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes the site installable (add-to-home-screen with
 * standalone chrome). Icons are placeholders in /public/icons; swap the PNGs
 * to rebrand without touching this file.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "John Marr — Shows, Games, Music & Stories",
    short_name: "John Marr",
    description:
      "Watch original shows, play games with friends, listen to music, and read stories — all free.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f0f",
    theme_color: "#0f0f0f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
