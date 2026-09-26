"use client";

import type { Feel } from "@/lib/types";

const FACES: Record<Feel, string> = {
  1: "M8.5 14.5c1 1.6 2.2 2.3 3.5 2.3s2.5-.7 3.5-2.3", // smile
  2: "M8.5 15.5h7", // level
  3: "M8.5 16.5c1-1.4 2.2-2 3.5-2s2.5.6 3.5 2", // effort
};
export const FEEL_LABELS: Record<Feel, string> = { 1: "Easier", 2: "Same", 3: "Harder" };

function Face({ feel }: { feel: Feel }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="9" cy="10" r=".9" fill="currentColor" />
      <circle cx="15" cy="10" r=".9" fill="currentColor" />
      <path d={FACES[feel]} />
    </svg>
  );
}

/** "How did movement feel?" Easier / Same / Harder, compared with last time. */
export function FeelPicker({ value, onChange, legend = "How did movement feel?" }: { value: Feel | null; onChange: (f: Feel) => void; legend?: string }) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-3 gap-3">
        {([1, 2, 3] as Feel[]).map((f) => {
          const on = value === f;
          return (
            <label key={f} className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal ${on ? "border-teal bg-mint-wash text-teal" : "border-line bg-surface text-ink"}`}>
              <input type="radio" name="feel" value={f} checked={on} onChange={() => onChange(f)} className="sr-only" />
              <Face feel={f} />
              {FEEL_LABELS[f]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
