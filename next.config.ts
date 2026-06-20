import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
      {
        protocol: "https",
        hostname: "vumbnail.com",
        pathname: "/**",
      },
    ],
  },
  // Serve Firebase Auth's handler/helpers FIRST-PARTY from our own domain by
  // proxying to the project's firebaseapp.com host. Combined with
  // authDomain="johnmarr.com", the Google OAuth round-trip stays same-origin,
  // so iOS Safari/Chrome ITP no longer drops the redirect — the cause of broken
  // sign-in on iOS. (Firebase Hosting does this automatically; App Hosting needs
  // it declared here.)
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://johnmarr-com.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://johnmarr-com.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
};

export default nextConfig;
