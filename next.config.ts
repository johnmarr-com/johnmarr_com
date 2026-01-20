import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Firebase App Hosting to include public folder
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
};

export default nextConfig;
