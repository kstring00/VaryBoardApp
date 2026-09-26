import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Eric's real board photo. The only board photo the app may show (never a generated image).
 * TODO: reference photo. Not in the repo yet: until /public/board/reference.jpg exists, board
 * visuals are the flat schematic from lib/board/geometry.ts on plaster. Once it lands it appears
 * behind the next-session card and the session setup hero automatically.
 */
export const REFERENCE_PHOTO = "/board/reference.jpg";

export function referencePhoto(): string | null {
  try {
    return existsSync(path.join(process.cwd(), "public", REFERENCE_PHOTO)) ? REFERENCE_PHOTO : null;
  } catch {
    return null;
  }
}
