/**
 * pnpm video:upload <movement-slug> <video.mp4> <poster.jpg>
 *
 * Puts a movement's demo video and poster online and saves the links on the movement.
 *  - Mux when MUX_TOKEN_ID and MUX_TOKEN_SECRET are set (video_url becomes "mux:<playback id>"),
 *    otherwise Supabase Storage (public bucket "movement-media").
 *  - The poster is required. It is resized to 960 px wide and compressed before upload.
 *  - It never marks the movement reviewed: Eric flips reviewed_by_eric himself after watching it.
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server key; keep it off laptops you
 * share).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const [slug, videoPath, posterPath] = process.argv.slice(2);
function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!slug || !videoPath || !posterPath) die("usage: pnpm video:upload <movement-slug> <video.mp4> <poster.jpg>");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) die("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: mv } = await sb.from("movements").select("id, name").eq("slug", slug).maybeSingle();
  if (!mv) die(`no movement with slug "${slug}"`);

  const poster = await sharp(readFileSync(posterPath)).resize({ width: 960, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  const posterKey = `posters/${slug}.jpg`;
  const up = await sb.storage.from("movement-media").upload(posterKey, poster, { contentType: "image/jpeg", upsert: true });
  if (up.error) die(`poster upload failed: ${up.error.message}`);
  const posterUrl = sb.storage.from("movement-media").getPublicUrl(posterKey).data.publicUrl;
  console.log(`✓ poster ${Math.round(poster.length / 1024)} KB -> ${posterUrl}`);

  let videoUrl: string;
  const muxId = process.env.MUX_TOKEN_ID;
  const muxSecret = process.env.MUX_TOKEN_SECRET;
  if (muxId && muxSecret) {
    const auth = `Basic ${Buffer.from(`${muxId}:${muxSecret}`).toString("base64")}`;
    const mux = async (p: string, init?: RequestInit) => {
      const r = await fetch(`https://api.mux.com${p}`, { ...init, headers: { Authorization: auth, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
      if (!r.ok) die(`Mux ${p}: ${r.status} ${await r.text()}`);
      return (await r.json()).data;
    };
    const upload = await mux("/video/v1/uploads", { method: "POST", body: JSON.stringify({ cors_origin: "*", new_asset_settings: { playback_policy: ["public"], video_quality: "basic" } }) });
    const put = await fetch(upload.url, { method: "PUT", body: readFileSync(videoPath) });
    if (!put.ok) die(`Mux upload failed: ${put.status}`);
    let assetId: string | undefined;
    for (let i = 0; i < 60 && !assetId; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      assetId = (await mux(`/video/v1/uploads/${upload.id}`)).asset_id;
    }
    if (!assetId) die("Mux did not create the asset in time; run again later");
    const asset = await mux(`/video/v1/assets/${assetId}`);
    videoUrl = `mux:${asset.playback_ids[0].id}`;
  } else {
    const ext = path.extname(videoPath).toLowerCase() || ".mp4";
    const videoKey = `videos/${slug}${ext}`;
    const v = await sb.storage.from("movement-media").upload(videoKey, readFileSync(videoPath), { contentType: ext === ".webm" ? "video/webm" : "video/mp4", upsert: true });
    if (v.error) die(`video upload failed: ${v.error.message}`);
    videoUrl = sb.storage.from("movement-media").getPublicUrl(videoKey).data.publicUrl;
  }

  const { error } = await sb.from("movements").update({ video_url: videoUrl, poster_url: posterUrl }).eq("slug", slug);
  if (error) die(`could not save the links: ${error.message}`);
  console.log(`✓ ${mv.name}: video_url = ${videoUrl}`);
  console.log("  Next: watch it in the app, then set reviewed_by_eric = true in Supabase when it is right.");
}

main();
