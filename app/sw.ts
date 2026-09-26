/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, RangeRequestsPlugin, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

/**
 * Service worker (built by @serwist/next into public/sw.js).
 *  - Offline shell: app pages and assets are cached as they are visited; /app/offline is the
 *    fallback for a page that was never visited.
 *  - Movement videos: a video the person has watched to the end is stored whole in the
 *    "vb-videos" cache by the page (components/VideoPlayer.tsx); here it is served from that
 *    cache, with byte-range support so it plays offline. Unwatched videos are never downloaded.
 */
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.destination === "video" || /\.(mp4|m4v|webm)(\?|$)/i.test(request.url),
      handler: new CacheFirst({
        cacheName: "vb-videos",
        plugins: [
          // Only whole files (added by the page after a video is watched) are cached; a normal
          // streaming response (206) passes straight through.
          new CacheableResponsePlugin({ statuses: [200] }),
          new RangeRequestsPlugin(),
          new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/app/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
