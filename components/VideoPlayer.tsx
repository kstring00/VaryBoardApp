"use client";

import { useEffect, useRef } from "react";
import { HexTile } from "@/components/HexTile";
import { resolveVideo, VIDEO_CACHE } from "@/lib/video";

/** Keeps a watched MP4 on the device so the session works offline next time. */
export async function keepVideoOffline(url: string) {
  try {
    if (!("caches" in window)) return;
    const cache = await caches.open(VIDEO_CACHE);
    if (!(await cache.match(url))) await cache.add(new Request(url, { mode: "cors" }));
  } catch {
    /* storage full or blocked: streaming still works */
  }
}

/**
 * Lazy video: nothing downloads until the person presses play (preload="none", poster first).
 * No video yet: a mint hex tile with the movement name (never a generated person).
 */
export function VideoPlayer({ name, videoUrl, posterUrl, onWatched }: { name: string; videoUrl: string | null; posterUrl: string | null; onWatched?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const source = resolveVideo(videoUrl, posterUrl);

  useEffect(() => {
    const el = ref.current;
    if (!el || !source || source.kind !== "hls") return;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = source.src;
      return;
    }
    let destroy: (() => void) | undefined;
    let cancelled = false;
    const attach = () => {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const hls = new Hls();
        hls.loadSource(source.src);
        hls.attachMedia(el);
        destroy = () => hls.destroy();
      });
    };
    el.addEventListener("play", attach, { once: true });
    return () => {
      cancelled = true;
      el.removeEventListener("play", attach);
      destroy?.();
    };
  }, [source?.src, source?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!source) return <HexTile name={name} portrait />;
  return (
    <video
      ref={ref}
      // Portrait-first, fits either orientation. Starts muted so it never stops the person's own
      // music (no audio focus); the controls unmute it. No autoplay, no intro to sit through.
      className="mx-auto max-h-[70dvh] w-full rounded-xl bg-ink object-contain"
      controls
      playsInline
      muted
      preload="none"
      poster={source.poster ?? undefined}
      src={source.kind === "mp4" ? source.src : undefined}
      aria-label={`Video: ${name}`}
      onEnded={() => {
        if (source.cacheable) void keepVideoOffline(source.src);
        onWatched?.();
      }}
    />
  );
}
