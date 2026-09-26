import type { PDFFont, PDFPage, RGB } from "pdf-lib";

/** Helpers shared by the clinician handout (server) and the progress summary (device). */

/** Standard PDF fonts only cover WinAnsi; replace anything else so rendering never throws. */
export function safe(text: string): string {
  return text
    .replace(/[→➔]/g, "->")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");
}

export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(tryLine, size) <= maxWidth || !line) line = tryLine;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A simple top-down text cursor on one page. */
export class Cursor {
  y: number;
  constructor(
    private page: PDFPage,
    private x: number,
    top: number,
    private width: number,
  ) {
    this.y = top;
  }
  text(text: string, font: PDFFont, size: number, color: RGB, gap = 4) {
    for (const l of wrap(text, font, size, this.width)) {
      this.page.drawText(l, { x: this.x, y: this.y - size, size, font, color });
      this.y -= size * 1.3;
    }
    this.y -= gap;
  }
  space(n: number) {
    this.y -= n;
  }
}
