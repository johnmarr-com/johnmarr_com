"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Button } from "@/JMKit";

export default function AboutPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // If user is already logged in, send them to the dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  if (!isLoading && user) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#FF36AB", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh items-center justify-center overflow-hidden bg-black p-[40px]">
      {/* Window/mask: width capped to image size OR viewport, height by viewport. Always 40px margins. */}
      <div
        className="relative overflow-hidden rounded-4xl"
        style={{
          width: "min(1024px, calc(100dvh - 80px), calc(100vw - 80px))",
          height: "min(1024px, calc(100dvh - 80px))",
        }}
      >
        {/* Login link: follows the mask edges — 35px from right, 25px from top */}
        <Link
          href="/auth?login=true"
          className="absolute right-[35px] top-[25px] z-10 rounded-full px-5 py-2 font-medium text-white transition-all duration-300 hover:scale-110 hover:bg-white/30 hover:font-bold"
          style={{
            fontSize: "calc(min(1024px, calc(100dvh - 80px)) / 45)",
          }}
        >
          Log In
        </Link>

        {/* Featured By banner: locked to bottom of mask, centered horizontally */}
        <Image
          src="/images/bgs/JMP-Featured-By.png"
          alt="Featured by Apple, Popular Science, TEDx, Rolling Stone, Billboard"
          width={525}
          height={73}
          className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2"
        />

        {/* Image container: square, sized only by viewport height, centered horizontally */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: "min(1024px, calc(100dvh - 80px))",
            height: "min(1024px, calc(100dvh - 80px))",
          }}
        >
          {/* Placeholder image — shown until video loads */}
          <Image
            src="/images/bgs/JMP-Magical-Door-SM-Web.jpg"
            alt="John Marr Presents Super Cool Stuff"
            width={1024}
            height={1024}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${videoLoaded ? "opacity-0" : "opacity-100"}`}
            priority
          />

          {/* Looping video — replaces image once loaded */}
          <video
            ref={videoRef}
            src="/images/bgs/JMP-Magical-Door-Long.mp4"
            autoPlay
            loop
            muted
            playsInline
            onCanPlay={() => setVideoLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${videoLoaded ? "opacity-100" : "opacity-0"}`}
          />

          {/* Sign Up button positioned relative to the image container */}
          <div
            className="absolute left-1/2"
            style={{
              top: "calc(67% - min(1024px, calc(100dvh - 80px)) / 20)",
              transform: "translateX(-50%)",
            }}
          >
            <Button
              asChild
              className="animate-gentle-pulse rounded-full shadow-lg"
              style={{
                width: "calc(min(900px, calc(100dvh - 80px)) / 3.5)",
                height: "calc(min(900px, calc(100dvh - 80px)) / 12)",
                fontSize: "calc(min(900px, calc(100dvh - 80px)) / 30)",
              }}
            >
              <Link href="/auth">Sign Up FREE</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
