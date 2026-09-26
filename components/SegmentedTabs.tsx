"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

/** Accessible segmented control (tablist). Arrow keys move between segments. */
export function SegmentedTabs<T extends string>({ label, options, value, onChange, panels }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; panels?: Record<T, ReactNode> }) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className="grid rounded-full bg-dormant/60 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${o.value}`}
              aria-selected={on}
              aria-controls={panels ? `${id}-panel-${o.value}` : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={`min-h-12 rounded-full px-1 text-[0.95rem] font-semibold leading-tight transition-colors ${on ? "bg-surface text-teal shadow-soft" : "text-muted"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {panels &&
        options.map((o) => (
          <div key={o.value} role="tabpanel" id={`${id}-panel-${o.value}`} aria-labelledby={`${id}-tab-${o.value}`} hidden={o.value !== value} className="mt-4">
            {o.value === value && panels[o.value]}
          </div>
        ))}
    </div>
  );
}
