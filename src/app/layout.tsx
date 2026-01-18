import type { Metadata } from "next";
import { Crimson_Pro, JetBrains_Mono } from "next/font/google";
import { jmJambo } from "@/fonts";
import { Providers } from "./providers";
import "./globals.css";

const crimsonPro = Crimson_Pro({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "John Marr",
  description: "Personal website of John Marr",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${crimsonPro.variable} ${jetbrainsMono.variable} ${jmJambo.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
