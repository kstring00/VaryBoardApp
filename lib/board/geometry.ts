/**
 * Real Vary Board geometry. Every board drawing in the app is generated from these numbers,
 * never from an illustration.
 *
 * Spec (from the product brief, confirmed values in the site's content/facts.ts):
 *  - One section is 25 in tall, 8 in wide and stands 3 in off the wall.
 *  - 47 hex anchor points per section.
 *  - Rows alternate 2 and 3 anchors across. 19 rows that start and end on a 2-row give
 *    10 x 2 + 9 x 3 = 47, the only 2/3 alternation that lands on 47.
 *  - Teal-gray face, gray side rails, one center screw per section.
 *  - Vary Board = 3 sections (141 anchors). Vary Board XT = 4 sections (188 anchors).
 *
 * TODO: reference photo. /public/board/reference.jpg (Eric's photo) is not in the repo yet, so
 * the BoardMap is a flat schematic. When the photo lands, check the row pattern, rail width and
 * opening size against it and adjust the constants below. Only constants change; anchor
 * addresses ({section,row,col}) stay stable as long as the row pattern does.
 *
 * Coordinates are inches. x = 0 is the left edge of the board; y = 0 is the bottom of
 * section 1 and grows upward (the renderer flips it).
 */
import type { AnchorCell, BoardModel } from "@/lib/types";

export const SECTION = { heightIn: 25, widthIn: 8, depthIn: 3 } as const;
export const ANCHORS_PER_SECTION = 47;
export const SECTIONS_BY_MODEL: Record<BoardModel, number> = { vb: 3, xt: 4 };
export const MODEL_NAMES: Record<BoardModel, string> = { vb: "Vary Board", xt: "Vary Board XT" };

/** Rows per section and anchors per row, bottom row first. */
export const ROWS_PER_SECTION = 19;
export function anchorsInRow(row: number): number {
  // Row 1 (bottom) is a 2-row, row 2 a 3-row, and so on up to row 19, a 2-row.
  return row % 2 === 1 ? 2 : 3;
}

/** Schematic proportions (inches). Adjust against the reference photo. */
export const LAYOUT = {
  /** Width of each gray side rail. */
  railIn: 0.75,
  /** Horizontal distance between neighbouring anchors in a 3-row. */
  colPitchIn: 2.3,
  /** Flat-top hexagon circumradius of an anchor opening. */
  hexRadiusIn: 0.68,
  /** Assumed height of the bottom of section 1 above the floor (site config fitPlanner.mountBottomIn, unconfirmed). */
  mountBottomIn: 2,
} as const;

export const ROW_PITCH_IN = SECTION.heightIn / ROWS_PER_SECTION;

export interface AnchorPoint extends AnchorCell {
  /** Stable id, e.g. "2-16-2". */
  id: string;
  x: number;
  y: number;
  /** True for the anchor with the section's center screw behind it. */
  centerScrew: boolean;
}

export function cellId(c: AnchorCell): string {
  return `${c.section}-${c.row}-${c.col}`;
}

export function sectionCount(model: BoardModel): number {
  return SECTIONS_BY_MODEL[model];
}

export function boardHeightIn(model: BoardModel): number {
  return sectionCount(model) * SECTION.heightIn;
}

/** x of an anchor centre within the section. */
function anchorX(row: number, col: number): number {
  const mid = SECTION.widthIn / 2;
  const n = anchorsInRow(row);
  const offset = col - (n + 1) / 2; // 2-row: -0.5, +0.5; 3-row: -1, 0, +1
  return mid + offset * LAYOUT.colPitchIn;
}

/** The centre row of a section (row 10 of 19, a 3-row) holds the center screw in its middle anchor. */
export const CENTER_ROW = (ROWS_PER_SECTION + 1) / 2;
export const CENTER_COL = 2;

export function sectionAnchors(section: number): AnchorPoint[] {
  const out: AnchorPoint[] = [];
  const base = (section - 1) * SECTION.heightIn;
  for (let row = 1; row <= ROWS_PER_SECTION; row++) {
    const y = base + (row - 0.5) * ROW_PITCH_IN;
    for (let col = 1; col <= anchorsInRow(row); col++) {
      const cell = { section, row, col };
      out.push({ ...cell, id: cellId(cell), x: anchorX(row, col), y, centerScrew: row === CENTER_ROW && col === CENTER_COL });
    }
  }
  return out;
}

export function boardAnchors(model: BoardModel): AnchorPoint[] {
  const out: AnchorPoint[] = [];
  for (let s = 1; s <= sectionCount(model); s++) out.push(...sectionAnchors(s));
  return out;
}

export function isValidCell(c: AnchorCell, model: BoardModel): boolean {
  return (
    Number.isInteger(c.section) &&
    Number.isInteger(c.row) &&
    Number.isInteger(c.col) &&
    c.section >= 1 &&
    c.section <= sectionCount(model) &&
    c.row >= 1 &&
    c.row <= ROWS_PER_SECTION &&
    c.col >= 1 &&
    c.col <= anchorsInRow(c.row)
  );
}

/** Approximate height of an anchor above the floor, in inches (depends on the unconfirmed mount height). */
export function heightAboveFloorIn(c: AnchorCell): number {
  return LAYOUT.mountBottomIn + (c.section - 1) * SECTION.heightIn + (c.row - 0.5) * ROW_PITCH_IN;
}

const COL_WORDS: Record<number, Record<number, string>> = {
  2: { 1: "left", 2: "right" },
  3: { 1: "left", 2: "middle", 3: "right" },
};

/** "Section 2, row 16, left" — plain words for screen readers and captions. */
export function describeCell(c: AnchorCell): string {
  const word = COL_WORDS[anchorsInRow(c.row)]?.[c.col] ?? `column ${c.col}`;
  return `section ${c.section}, row ${c.row}, ${word}`;
}

/** Flat-top hexagon points around (cx, cy) in a y-down coordinate space. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`);
  }
  return pts.join(" ");
}

const SECTION_NAMES: Record<BoardModel, string[]> = {
  vb: ["bottom", "middle", "top"],
  xt: ["bottom", "lower middle", "upper middle", "top"],
};

export function sectionName(section: number, model: BoardModel): string {
  return SECTION_NAMES[model][section - 1] ?? `section ${section}`;
}

const ORD = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/**
 * Plain-language directions a person can follow at the wall, counting rows up from the bottom
 * of a section: "Middle section, 16th row up, middle hexagon."
 */
export function describePattern(cells: AnchorCell[], model: BoardModel): string[] {
  if (!cells.length) return [];
  const bySection = new Map<number, AnchorCell[]>();
  for (const c of cells) bySection.set(c.section, [...(bySection.get(c.section) ?? []), c]);
  const out: string[] = [];
  for (const [s, cs] of [...bySection.entries()].sort((a, b) => a[0] - b[0])) {
    const name = sectionName(s, model);
    const sec = name.charAt(0).toUpperCase() + name.slice(1) + " section";
    const rows = [...new Set(cs.map((c) => c.row))].sort((a, b) => a - b);
    if (rows.length === 1) {
      const words = cs
        .sort((a, b) => a.col - b.col)
        .map((c) => COL_WORDS[anchorsInRow(c.row)]?.[c.col] ?? `column ${c.col}`);
      const which = words.length === 1 ? `${words[0]} hexagon` : `${words.join(" and ")} hexagons`;
      out.push(`${sec}, ${ORD(rows[0])} row up, ${which}.`);
    } else {
      out.push(`${sec}, rows ${rows[0]} to ${rows[rows.length - 1]} up (${cs.length} hexagons).`);
    }
  }
  return out;
}
