"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MODEL_NAMES } from "@/lib/board/geometry";
import { clearDeviceData, updateProfile, updateSettings, useProfile, useSettings, type Settings } from "@/lib/client/store";

function Choice<T extends string>({ legend, name, value, options, onChange, hint }: { legend: string; name: string; value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; hint?: string }) {
  return (
    <fieldset className="card p-5">
      <legend className="float-left w-full font-display text-2xl">{legend}</legend>
      {hint && <p className="clear-both pt-1 text-sm text-muted">{hint}</p>}
      <div className="clear-both mt-3 grid gap-2">
        {options.map((o) => (
          <label key={o.value} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal ${value === o.value ? "border-teal bg-mint-wash" : "border-line bg-surface"}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="h-5 w-5 accent-[var(--color-teal)]" />
            <span>
              <span className="block font-semibold">{o.label}</span>
              {o.hint && <span className="block text-sm text-muted">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="card flex min-h-16 cursor-pointer items-center justify-between gap-4 p-5 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal">
      <span>
        <span className="block font-display text-2xl">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-7 w-7 shrink-0 accent-[var(--color-teal)]" />
    </label>
  );
}

export function SettingsView() {
  const router = useRouter();
  const s = useSettings();
  const profile = useProfile();
  const [name, setName] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  useEffect(() => {
    if (name === null) return;
    const t = window.setTimeout(() => updateProfile({ firstName: name.trim().slice(0, 40) }), 300);
    return () => window.clearTimeout(t);
  }, [name]);

  return (
    <div className="mt-6 space-y-5">
      <div className="card p-5">
        <label htmlFor="first-name" className="font-display text-2xl">
          Your first name
        </label>
        <p className="text-sm text-muted">Optional. Used for the greeting on Today. Never sent anywhere.</p>
        <input id="first-name" className="field mt-3" autoComplete="given-name" maxLength={40} value={name ?? profile?.firstName ?? ""} onChange={(e) => setName(e.target.value)} />
      </div>

      <Choice
        legend="Text size"
        name="text-size"
        value={s.textSize}
        onChange={(v) => set({ textSize: v })}
        options={[
          { value: "default", label: "Default" },
          { value: "large", label: "Large" },
          { value: "largest", label: "Largest" },
        ]}
      />

      <Choice
        legend="Motion"
        name="motion"
        value={s.motion}
        onChange={(v) => set({ motion: v })}
        options={[
          { value: "system", label: "Match my phone", hint: "Follows your phone's reduce-motion setting." },
          { value: "reduce", label: "Reduce motion", hint: "No animations anywhere in the app." },
        ]}
      />

      <Choice
        legend="Your board"
        name="board"
        value={s.boardModel}
        onChange={(v) => set({ boardModel: v })}
        hint="The board maps match the board on your wall."
        options={[
          { value: "vb", label: MODEL_NAMES.vb, hint: "3 sections, 141 anchor points" },
          { value: "xt", label: MODEL_NAMES.xt, hint: "4 sections, 188 anchor points" },
        ]}
      />

      <Toggle label="Prefer seated versions" hint="For chair or wheelchair users: when an exercise has a seated version, it is used first." checked={s.preferSeated} onChange={(v) => set({ preferSeated: v })} />
      <Toggle label="Spoken cues" hint="Says the exercise and your target when the timer starts. Mixes with your music instead of stopping it." checked={s.spokenCues} onChange={(v) => set({ spokenCues: v })} />

      <section aria-labelledby="data-h" className="card p-5">
        <h2 id="data-h" className="text-2xl">
          Data on this phone
        </h2>
        <p className="mt-2">
          This phone keeps your plan, your sessions, your name, appointment and notes. Only session results (which exercises were done, and how movement felt) go to your therapist, with your code and a random device number. No name, email or health details.
        </p>
        {!confirming ? (
          <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setConfirming(true)}>
            Clear device data
          </button>
        ) : (
          <div className="mt-4 rounded-xl bg-warn-bg p-4 text-warn-ink" role="alertdialog" aria-labelledby="clear-h">
            <p id="clear-h" className="font-semibold">
              Remove your plan, sessions, name, appointment and notes from this phone?
            </p>
            <p className="mt-1">Sessions already sent to your therapist stay with them.</p>
            <button
              type="button"
              className="btn mt-3 w-full bg-danger text-white"
              onClick={async () => {
                await clearDeviceData();
                setConfirming(false);
                setName(null);
                router.push("/app");
              }}
            >
              Yes, clear everything
            </button>
            <button type="button" className="btn btn-quiet mt-1 w-full" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
