import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import withSerwistInit from "@serwist/next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be cached by the CDN, or updates stall.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
  async redirects() {
    // This repo is only the app. When merged into the site repo, drop this redirect.
    return [{ source: "/", destination: "/app", permanent: false }];
  },
};

export default function config(phase: string): NextConfig {
  // The service worker is built by the webpack production build (`pnpm build`); dev uses Turbopack without it.
  if (phase === PHASE_DEVELOPMENT_SERVER) return nextConfig;
  const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    cacheOnNavigation: true,
    reloadOnOnline: false,
    additionalPrecacheEntries: [{ url: "/app/offline", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now()) }],
  });
  return withSerwist(nextConfig);
}
