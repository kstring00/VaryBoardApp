/**
 * Generates the app icons and the share image from SVG (no photos, no people):
 *   public/icons/icon.svg, icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
 *   public/og.png (1200 x 630)
 * Run after changing the mark:  node scripts/make-icons.mjs
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const PLASTER = "#f1efea";
const TEAL = "#1e4d46";
const MINT = "#62bba6";
const MINT_SOFT = "#9ed6c6";

// The mark: two teal bars and a mint anchor hex, on a 32-unit grid.
const mark = `<rect x="7" y="3" width="7" height="26" rx="2.5" fill="${TEAL}"/><rect x="18" y="3" width="7" height="26" rx="2.5" fill="${TEAL}"/><polygon points="21.5,12 24,13.5 24,16.5 21.5,18 19,16.5 19,13.5" fill="${MINT_SOFT}"/>`;

const icon = (size, { rounded = true, pad = 0.12 } = {}) => {
  const inner = size * (1 - 2 * pad);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${PLASTER}"/>
  <g transform="translate(${size * pad} ${size * pad}) scale(${inner / 32})">${mark}</g>
</svg>`;
};

writeFileSync("public/icons/icon.svg", icon(64));
await sharp(Buffer.from(icon(192))).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(icon(512))).png().toFile("public/icons/icon-512.png");
// Maskable: full-bleed background, mark inside the 80% safe zone.
await sharp(Buffer.from(icon(512, { rounded: false, pad: 0.22 }))).png().toFile("public/icons/maskable-512.png");
await sharp(Buffer.from(icon(180, { rounded: false, pad: 0.14 }))).png().toFile("public/icons/apple-touch-icon.png");

// Share image: a honeycomb filling in (progress), the mark and the tagline.
const hex = (cx, cy, r, fill, stroke) => {
  const pts = Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
};
let comb = "";
const r = 46;
const w = Math.sqrt(3) * r;
for (let row = 0; row < 8; row++)
  for (let col = 0; col < 7; col++) {
    const cx = 720 + col * w + (row % 2 ? w / 2 : 0);
    const cy = 20 + row * r * 1.5;
    const filled = (row * 7 + col) % 3 !== 1 && row > 2 && col < 5;
    comb += hex(cx, cy, r - 4, filled ? MINT : "none", filled ? MINT : "#c9d9d3");
  }
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PLASTER}"/>
  ${comb}
  <g transform="translate(80 150) scale(3.2)">${mark}</g>
  <text x="200" y="232" font-family="DejaVu Serif, Georgia, serif" font-size="64" fill="${TEAL}">Vary Board</text>
  <text x="80" y="370" font-family="DejaVu Serif, Georgia, serif" font-size="58" fill="#16302b">Your program.</text>
  <text x="80" y="440" font-family="DejaVu Serif, Georgia, serif" font-size="58" fill="#16302b">Beyond the clinic.</text>
  <text x="80" y="520" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#475d58">The companion app for the Vary Board</text>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile("public/og.png");
console.log("✓ icons and share image written");
