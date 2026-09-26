/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, RangeRequestsPlugin, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";
import { kvGet } from "@/lib/idb";
import { t } from "@/lib/copy";

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

/*
 * Reminders. The push carries no text; the notification is written here from what this device
 * knows (the next session's name, saved in IndexedDB by the app). One action: turn them off.
 */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const saved = await kvGet<{ sessionName: string | null }>("reminder");
      const body = saved?.sessionName ? t("remind.notification", { session: saved.sessionName }) : t("remind.notificationFallback");
      await self.registration.showNotification("Vary Board", {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "vb-reminder",
        data: { url: "/app?from=reminder" },
        // Not every platform shows actions (iOS does not); Today offers the same switch.
        actions: [{ action: "off", title: t("remind.off") }],
      } as NotificationOptions);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "off") {
    event.waitUntil(
      (async () => {
        const sub = await self.registration.pushManager.getSubscription();
        const deviceId = await kvGet<string>("deviceId");
        if (sub && deviceId) await fetch("/app/api/push/off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, endpoint: sub.endpoint }) }).catch(() => {});
        await sub?.unsubscribe().catch(() => {});
      })(),
    );
    return;
  }
  const url = (event.notification.data as { url?: string } | null)?.url ?? "/app";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).pathname.startsWith("/app"));
      if (open) {
        await open.focus();
        await (open as WindowClient).navigate(url).catch(() => {});
      } else await self.clients.openWindow(url);
    })(),
  );
});
