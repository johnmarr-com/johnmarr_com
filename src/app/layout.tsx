import type { Metadata, Viewport } from "next";
import { crimsonPro, jetbrainsMono, jmJambo } from "@/fonts";
import { Providers } from "./providers";
import "./globals.css";

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://johnmarr.com";

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "John Marr",
    template: "%s | John Marr",
  },
  description:
    "Shows, games, music, and stories — a free entertainment universe by John Marr.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "John Marr",
  },
  openGraph: {
    siteName: "John Marr",
    type: "website",
    url: "/",
    title: "John Marr",
    description:
      "Shows, games, music, and stories — a free entertainment universe by John Marr.",
    images: [{ url: "/images/bgs/BG-Signup.jpg", width: 1920, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${crimsonPro.variable} ${jetbrainsMono.variable} ${jmJambo.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
