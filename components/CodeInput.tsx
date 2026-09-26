"use client";

import { useId, useRef, useState } from "react";

/**
 * 6-character program code. One real input (so paste, autofill and screen readers just work)
 * drawn as six large boxes.
 */
export function CodeInput({ value, onChange, invalid, describedBy }: { value: string; onChange: (v: string) => void; invalid?: boolean; describedBy?: string }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const clean = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return (
    <div>
      <label htmlFor={id} className="label">
        Program code
      </label>
      <div className="relative" onClick={() => ref.current?.focus()}>
        <div className="grid grid-cols-6 gap-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => {
            const active = focused && (i === value.length || (value.length === 6 && i === 5));
            return (
              <div
                key={i}
                className={`flex h-16 items-center justify-center rounded-lg border-2 bg-white font-display text-3xl font-semibold ${
                  invalid ? "border-danger" : active ? "border-teal ring-2 ring-mint" : "border-line"
                }`}
              >
                {value[i] ?? ""}
              </div>
            );
          })}
        </div>
        <input
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(clean(e.target.value))}
          onPaste={(e) => {
            e.preventDefault();
            onChange(clean(e.clipboardData.getData("text")));
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={6}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>
    </div>
  );
}
