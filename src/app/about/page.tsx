"use client";

import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-hidden bg-black">
      {/* Square container: min(1024px, 100dvh), always square, centered */}
      <div
        className="relative shrink-0 overflow-hidden rounded-2xl"
        style={{
          width: "min(1024px, 100dvh)",
          height: "min(1024px, 100dvh)",
        }}
      >
        <Image
          src="/images/bgs/JMP-Magical-Door-SM-Web.jpg"
          alt="John Marr Presents Super Cool Stuff"
          width={1024}
          height={1024}
          className="h-full w-full object-cover"
          priority
        />

        {/* Sign Up button: 1/3 width, half that for height, centered at 67% from top */}
        <div
          className="absolute left-1/2 flex flex-col items-center"
          style={{
            top: "calc(67% - min(1024px, 100dvh) / 12)",
            transform: "translateX(-50%)",
          }}
        >
          <Link
            href="/auth"
            className="flex items-center justify-center rounded-full font-bold text-black shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{
              width: "calc(min(1024px, 100dvh) / 3)",
              height: "calc(min(1024px, 100dvh) / 6)",
              fontSize: "calc(min(1024px, 100dvh) / 30)",
              background: "linear-gradient(135deg, #FFA500, #FF8C00)",
            }}
          >
            Sign Up For Free
          </Link>

          <Link
            href="/auth?login=true"
            className="mt-[30px] font-medium text-white transition-opacity hover:opacity-80"
            style={{
              fontSize: "calc(min(1024px, 100dvh) / 45)",
            }}
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
