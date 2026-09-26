"use client";

import { BoardMap, boardView } from "@/components/BoardMap";
import { MODEL_NAMES, describePattern } from "@/lib/board/geometry";
import { useSettings } from "@/lib/client/store";
import type { AnchorCell, BoardModel } from "@/lib/types";

/**
 * The board close-up with the saved anchor lit and a callout. Drawn from the real geometry;
 * shown over Eric's reference photo when it exists (TODO: calibrate the overlay to the photo's
 * framing once the photo lands; until then the photo is a soft backdrop).
 */
export function BoardHero({ anchor, boardModels, photo, callout = "Your saved anchor.", className = "" }: { anchor: AnchorCell | null; boardModels: BoardModel[]; photo: string | null; callout?: string; className?: string }) {
  const { boardModel } = useSettings();
  const model: BoardModel = anchor && anchor.section > 3 ? "xt" : boardModels.includes(boardModel) ? boardModel : boardModels[0] ?? "vb";
  const cells = anchor ? [anchor] : [];
  const view = boardView({ model, litCells: cells, crop: cells.length ? "lit" : "full", labels: true });
  const p = view.litPoints[0];
  const words = describePattern(cells, model)[0];
  return (
    <figure className={`relative overflow-hidden rounded-2xl bg-mint-wash ${className}`}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      )}
      <div className="relative flex justify-start py-4 pl-[12%]">
        <div className="relative inline-block">
          <BoardMap model={model} litCells={cells} crop={cells.length ? "lit" : "full"} labels className="block h-64 w-auto" title={`${MODEL_NAMES[model]} close-up`} />
          {p && (
            <div className="pointer-events-none absolute left-0 top-0 h-full w-full" aria-hidden="true">
              <span className="absolute h-px w-10 bg-ink" style={{ left: `${p.fx * 100}%`, top: `${p.fy * 100}%`, marginLeft: 12 }} />
              <span className="absolute w-max max-w-[9.5rem] rounded-2xl bg-teal px-3 py-1 text-sm font-semibold leading-snug text-white shadow-soft" style={{ left: `${p.fx * 100}%`, top: `${p.fy * 100}%`, marginLeft: 52, transform: "translateY(-50%)" }}>
                {callout}
              </span>
            </div>
          )}
        </div>
      </div>
      <figcaption className="relative px-4 pb-3 text-center text-sm text-ink">
        {words ?? "No anchor needed for this exercise."} <span className="text-muted">({MODEL_NAMES[model]}, sections numbered from the bottom)</span>
      </figcaption>
    </figure>
  );
}
