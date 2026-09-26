/**
 * BoardMap: SVG of the real Vary Board, generated from lib/board/geometry.ts (section size,
 * 47 anchors per section in rows of 2 and 3, gray side rails, center screw). Never an
 * illustration.
 *
 * TODO: reference photo. /public/board/reference.jpg is not in the repo yet, so this is a flat
 * schematic. Compare it with the photo when it arrives (see geometry.ts).
 *
 * Works in Server and Client Components. `interactive` + `onCellClick` only from Client ones.
 */
import type { KeyboardEvent } from "react";
import {
  LAYOUT,
  SECTION,
  boardAnchors,
  cellId,
  describeCell,
  hexPoints,
  sectionCount,
  MODEL_NAMES,
  type AnchorPoint,
} from "@/lib/board/geometry";
import type { AnchorCell, BoardModel } from "@/lib/types";

export interface BoardMapProps {
  model: BoardModel;
  litCells?: AnchorCell[];
  interactive?: boolean;
  onCellClick?: (cell: AnchorCell) => void;
  /** "full" draws the whole board; "lit" crops to the lit anchors with some board around them; a number draws that one section. */
  crop?: "full" | "lit" | number;
  /** Show section numbers down the left side. */
  labels?: boolean;
  className?: string;
  /** Accessible name. */
  title?: string;
}

const S = 10; // SVG units per inch
const LABEL_W = 2.2; // inches reserved on the left for section numbers

/** The drawn window (SVG units) and where each lit anchor lands, for HTML overlays. */
export function boardView({ model, litCells = [], crop = "full", labels = false }: Pick<BoardMapProps, "model" | "litCells" | "crop" | "labels">) {
  const sections = sectionCount(model);
  const totalH = sections * SECTION.heightIn;
  const anchors = boardAnchors(model);
  const lit = new Set(litCells.map(cellId));
  const litAnchors = anchors.filter((a) => lit.has(a.id));

  // Vertical window, in board inches (y up).
  let yLo = 0;
  let yHi = totalH;
  if (typeof crop === "number") {
    const sec = Math.min(Math.max(1, crop), sections);
    yLo = (sec - 1) * SECTION.heightIn;
    yHi = sec * SECTION.heightIn;
  } else if (crop === "lit" && litAnchors.length) {
    const pad = 4;
    yLo = Math.max(0, Math.min(...litAnchors.map((a) => a.y)) - pad);
    yHi = Math.min(totalH, Math.max(...litAnchors.map((a) => a.y)) + pad);
    const minSpan = 14;
    if (yHi - yLo < minSpan) {
      const mid = (yHi + yLo) / 2;
      yLo = Math.max(0, mid - minSpan / 2);
      yHi = Math.min(totalH, yLo + minSpan);
      yLo = Math.max(0, yHi - minSpan);
    }
  }
  const drawSections = Array.from({ length: sections }, (_, i) => i + 1).filter((s) => {
    const lo = (s - 1) * SECTION.heightIn;
    return lo < yHi && lo + SECTION.heightIn > yLo;
  });

  const left = labels ? LABEL_W : 0;
  const vbX = -left * S;
  const vbY = (totalH - yHi) * S;
  const vbW = (SECTION.widthIn + left) * S;
  const vbH = (yHi - yLo) * S;
  const toY = (yIn: number) => (totalH - yIn) * S;
  /** Lit anchors as fractions (0..1) of the drawing's width and height. */
  const litPoints = litAnchors.map((a) => ({ id: a.id, fx: (a.x * S - vbX) / vbW, fy: (toY(a.y) - vbY) / vbH }));
  return { sections, totalH, anchors, lit, litAnchors, drawSections, vbX, vbY, vbW, vbH, toY, litPoints };
}

export function BoardMap({ model, litCells = [], interactive = false, onCellClick, crop = "full", labels = false, className, title }: BoardMapProps) {
  const { anchors, lit, litAnchors, drawSections, vbX, vbY, vbW, vbH, toY } = boardView({ model, litCells, crop, labels });

  const name = title ?? `${MODEL_NAMES[model]} board map`;
  const litText = litAnchors.length ? `Lit anchors: ${litAnchors.map(describeCell).join("; ")}.` : "No anchors lit.";

  const hexR = LAYOUT.hexRadiusIn * S;
  const key = (a: AnchorPoint) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onCellClick?.(a);
    }
  };

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className={className}
      role={interactive ? "group" : "img"}
      aria-label={`${name}. ${litText}`}
      data-board-model={model}
      data-anchor-count={crop === "full" ? anchors.length : undefined}
    >
      {drawSections.map((s) => {
        const top = toY(s * SECTION.heightIn);
        const h = SECTION.heightIn * S;
        return (
          <g key={s} data-section={s}>
            {/* Gray side rails (the backer) */}
            <rect x={0} y={top} width={SECTION.widthIn * S} height={h} rx={3} className="fill-board-rail" />
            {/* Teal-gray face */}
            <rect x={LAYOUT.railIn * S} y={top + 1.5} width={(SECTION.widthIn - 2 * LAYOUT.railIn) * S} height={h - 3} rx={4} className="fill-board-face" />
            {/* Seam between sections */}
            {s > 1 && <line x1={0} x2={SECTION.widthIn * S} y1={top + h} y2={top + h} className="stroke-ink" strokeOpacity={0.55} strokeWidth={1.2} />}
            {labels && (
              <text x={-LABEL_W * S * 0.5} y={top + h / 2} textAnchor="middle" dominantBaseline="middle" className="fill-muted" style={{ fontSize: 16, fontWeight: 600 }}>
                {s}
              </text>
            )}
          </g>
        );
      })}
      {anchors
        .filter((a) => drawSections.includes(a.section))
        .map((a) => {
          const isLit = lit.has(a.id);
          const cx = a.x * S;
          const cy = toY(a.y);
          const shape = (
            <>
              <polygon points={hexPoints(cx, cy, hexR)} className={isLit ? "fill-surface stroke-ink" : "fill-board-hole stroke-board-face"} strokeWidth={isLit ? 2.4 : 0.8} />
              {isLit && <polygon points={hexPoints(cx, cy, hexR * 0.55)} className="fill-mint" />}
              {a.centerScrew && (
                <g aria-hidden="true" data-center-screw="">
                  <circle cx={cx} cy={cy} r={2} className={isLit ? "fill-ink" : "fill-board-rail"} />
                  <path d={`M${cx - 1.2} ${cy}h2.4M${cx} ${cy - 1.2}v2.4`} className="stroke-board-hole" strokeWidth={0.5} />
                </g>
              )}
            </>
          );
          if (!interactive) {
            return (
              <g key={a.id} data-anchor={a.id} data-lit={isLit || undefined}>
                {shape}
              </g>
            );
          }
          return (
            <g
              key={a.id}
              data-anchor={a.id}
              data-lit={isLit || undefined}
              role="button"
              tabIndex={0}
              aria-pressed={isLit}
              aria-label={describeCell(a)}
              onClick={() => onCellClick?.(a)}
              onKeyDown={key(a)}
              className="cursor-pointer outline-none [&:focus-visible>polygon:first-child]:stroke-teal [&:focus-visible>polygon:first-child]:[stroke-width:3]"
            >
              {shape}
            </g>
          );
        })}
    </svg>
  );
}
