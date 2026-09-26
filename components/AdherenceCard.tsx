"use client";

import { FEEL_LABELS } from "@/components/FeelPicker";
import type { AdherenceCompletion, AdherenceEvent } from "@/lib/clinician";
import { addDays, dayKey, startOfWeek } from "@/lib/progress";
import type { PatientProgram } from "@/lib/types";

/**
 * Adherence for one code, in the viewer's time zone. Neutral counts only:
 *  - sessions completed vs planned (days per week), this week and the last 4 weeks
 *  - active days in the last 30 days (distinct dates with any exercise done)
 *  - how movement felt (Easier / Same / Harder)
 *  - per exercise: done, skipped and made-easier counts, so the plan can be adjusted
 */
export function AdherenceCard({ program, completions, events }: { program: PatientProgram; completions: AdherenceCompletion[]; events: AdherenceEvent[] }) {
  const now = new Date();
  const thisWeek = startOfWeek(now);
  const planned = program.daysPerWeek;
  const rows = Array.from({ length: 5 }, (_, i) => {
    const from = addDays(thisWeek, -7 * i);
    const to = addDays(from, 7);
    const cs = completions.filter((c) => {
      const t = new Date(c.completedAt).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
    const feel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const c of cs) if (c.feel) feel[c.feel]++;
    return { key: dayKey(from), label: i === 0 ? "This week" : `Week of ${from.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, done: cs.length, feel };
  });

  const since30 = addDays(now, -30).getTime();
  const activeDays = new Set(events.filter((e) => e.event === "done" && new Date(e.occurredAt).getTime() >= since30).map((e) => dayKey(new Date(e.occurredAt)))).size;

  const feelAll: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const c of completions) if (c.feel) feelAll[c.feel]++;

  const names = new Map(program.sessions.flatMap((s) => s.blocks.map((b) => [b.id, { name: b.movement.name, session: s.name }] as const)));
  const per = new Map<string, { done: number; skipped: number; made_easier: number }>();
  for (const e of events) {
    const x = per.get(e.sessionBlockId) ?? { done: 0, skipped: 0, made_easier: 0 };
    x[e.event]++;
    per.set(e.sessionBlockId, x);
  }
  const last = completions.at(-1);

  return (
    <section aria-labelledby="adh-h" className="card p-5">
      <h2 id="adh-h" className="text-2xl">
        Adherence
      </h2>
      <p className="mt-1 text-muted">
        {completions.length === 0 && events.length === 0
          ? "Nothing yet. Sessions appear here as soon as your patient does one (or when their phone is back online)."
          : last
            ? `Last session: ${new Date(last.completedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
            : "Exercises logged; no session finished yet."}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-plaster p-3">
          <dt className="text-sm text-muted">Sessions this week</dt>
          <dd className="font-display text-3xl">
            {rows[0].done} <span className="text-lg text-muted">of {planned}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-plaster p-3">
          <dt className="text-sm text-muted">Active days, last 30 days</dt>
          <dd className="font-display text-3xl">{activeDays}</dd>
        </div>
      </dl>

      <table className="mt-5 w-full text-left">
        <caption className="sr-only">Sessions completed versus planned, this week and the last 4 weeks</caption>
        <thead>
          <tr className="text-sm text-muted">
            <th scope="col" className="py-1 font-semibold">
              Week
            </th>
            <th scope="col" className="py-1 font-semibold">
              Done / planned
            </th>
            <th scope="col" className="py-1 font-semibold">
              Easier · same · harder
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <th scope="row" className="py-2 font-medium">
                {r.label}
              </th>
              <td className="py-2">
                <span className="flex items-center gap-1">
                  {Array.from({ length: Math.max(planned, r.done) }).map((_, i) => (
                    <svg key={i} viewBox="0 0 20 22" className="h-5 w-4" aria-hidden="true">
                      <polygon points="10,1 19,6 19,16 10,21 1,16 1,6" className={i < r.done ? "fill-mint stroke-teal" : "fill-none stroke-line"} strokeWidth={1.5} />
                    </svg>
                  ))}
                  <span className="ml-1 text-sm">
                    {r.done}/{planned}
                  </span>
                </span>
              </td>
              <td className="py-2 text-sm">
                {r.feel[1]} · {r.feel[2]} · {r.feel[3]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-6 font-sans text-lg font-semibold">How movement felt (all sessions)</h3>
      <p>
        {FEEL_LABELS[1]} {feelAll[1]} · {FEEL_LABELS[2]} {feelAll[2]} · {FEEL_LABELS[3]} {feelAll[3]}
      </p>

      {per.size > 0 && (
        <>
          <h3 className="mt-6 font-sans text-lg font-semibold">By exercise (last 60 days)</h3>
          <ul className="mt-2 space-y-2">
            {[...per].map(([id, e]) => (
              <li key={id} className="rounded-lg bg-plaster p-3" data-exercise={id}>
                <span className="block font-medium">{names.get(id)?.name ?? "Removed exercise"}</span>
                <span className="block text-sm text-muted">
                  {names.get(id)?.session ? `${names.get(id)!.session} · ` : ""}done {e.done} · skipped {e.skipped} · made easier {e.made_easier}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
