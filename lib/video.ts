/**
 * Movement video sources. `video_url` holds either an MP4 URL (Supabase Storage) or
 * `mux:<playback-id>` when Mux hosts the video. Posters are required for real videos.
 */
export interface VideoSource {
  src: string;
  kind: "mp4" | "hls";
  poster: string | null;
  /** Only whole MP4 files can be kept for offline use. */
  cacheable: boolean;
}

export function resolveVideo(videoUrl: string | null, posterUrl: string | null): VideoSource | null {
  if (!videoUrl) return null;
  const mux = /^mux:([A-Za-z0-9]+)$/.exec(videoUrl.trim());
  if (mux) {
    const id = mux[1];
    return { src: `https://stream.mux.com/${id}.m3u8`, kind: "hls", poster: posterUrl ?? `https://image.mux.com/${id}/thumbnail.webp?width=960&fit_mode=preserve`, cacheable: false };
  }
  if (/\.m3u8(\?|$)/i.test(videoUrl)) return { src: videoUrl, kind: "hls", poster: posterUrl, cacheable: false };
  return { src: videoUrl, kind: "mp4", poster: posterUrl, cacheable: true };
}

export const VIDEO_CACHE = "vb-videos";
