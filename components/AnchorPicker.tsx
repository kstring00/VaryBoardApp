"use client";

import { useState } from "react";
import { BoardMap } from "@/components/BoardMap";
import { MODEL_NAMES, describePattern, sectionCount, sectionName } from "@/lib/board/geometry";
import type { AnchorCell, BoardModel } from "@/lib/types";

/**
 * Pick the anchor on the real board, one section at a time. What is picked here is what the
 * patient sees lit as "Your saved anchor". The address readout is the JSON Eric pastes into
 * Supabase (movements.default_anchor).
 */
export function AnchorPicker({ value, onChange, suggested }: { value: AnchorCell | null; onChange: (a: AnchorCell | null) => void; suggested: AnchorCell | null }) {
  const [model, setModel] = useState<BoardModel>(value && value.section > 3 ? "xt" : "vb");
  const [section, setSection] = useState(value?.section ?? suggested?.section ?? 2);
  const n = sectionCount(model);
  const shown = Math.min(section, n);
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Anchor position</p>
        <label className="text-sm">
          <span className="sr-only">Board model</span>
          <select className="field min-h-12 py-1" value={model} onChange={(e) => setModel(e.target.value as BoardModel)}>
            <option value="vb">{MODEL_NAMES.vb}</option>
            <option value="xt">{MODEL_NAMES.xt}</option>
          </select>
        </label>
      </div>
      <div role="radiogroup" aria-label="Section" className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: n }, (_, i) => n - i).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={shown === s} onClick={() => setSection(s)} className={`chip min-h-12 border-2 px-3 ${shown === s ? "border-teal bg-mint-wash font-semibold" : "border-line bg-surface"}`}>
            {s} · {sectionName(s, model)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-4">
        <BoardMap model={model} litCells={value ? [value] : []} crop={shown} interactive onCellClick={(c) => onChange({ section: c.section, row: c.row, col: c.col })} className="h-[26rem] w-auto shrink-0" title={`Section ${shown}: tap an anchor`} />
        <div className="min-w-0 space-y-2 text-sm">
          <p>Tap a hexagon to save it as the patient&rsquo;s anchor. Rows count up from the bottom of the section.</p>
          <p className="font-semibold" aria-live="polite">
            {value ? describePattern([value], value.section > 3 ? "xt" : model)[0] : "No anchor saved."}
          </p>
          {value && <code className="block break-all rounded bg-plaster p-2 text-xs">{JSON.stringify(value)}</code>}
          {suggested && (!value || value.section !== suggested.section || value.row !== suggested.row || value.col !== suggested.col) && (
            <button type="button" className="btn btn-quiet -ml-4 min-h-12" onClick={() => { onChange(suggested); setSection(suggested.section); }}>
              Use the suggested anchor
            </button>
          )}
          {value && (
            <button type="button" className="btn btn-quiet -ml-4 min-h-12" onClick={() => onChange(null)}>
              No anchor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
