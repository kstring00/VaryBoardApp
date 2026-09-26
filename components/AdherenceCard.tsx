"use client";

import type { AdherenceCompletion } from "@/lib/clinician";
import { FEEL_LABELS } from "@/components/FeelPicker";
import { addDays, dayKey, startOfWeek } from "@/lib/progress";
import type { PatientProgram } from "@/lib/types";

/**
 * Adherence for one code, in the viewer's time zone: sessions completed vs planned per week,
 * how movement felt, and where the patient made things easier, used a seated version or skipped.
 */
export function AdherenceCard({ program, completions, weeks = 6 }: { program: PatientProgram; completions: AdherenceCompletion[]; weeks?: number }) {
  const now = new Date();
  const thisWeek = startOfWeek(now);
  const rows = Array.from({ length: weeks }, (_, i) => {
    const from = addDays(thisWeek, -7 * (weeks - 1 - i));
    const to = addDays(from, 7);
    const cs = completions.filter((c) => {
      const t = new Date(c.completedAt).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
    const feel = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    for (const c of cs) if (c.feel) feel[c.feel]++;
    return { key: dayKey(from), label: from.toLocaleDateString(undefined, { month: "short", day: "numeric" }), done: cs.length, feel, current: i === weeks - 1 };
  });
  const planned = program.daysPerWeek;

  const blocks = new Map(program.sessions.flatMap((s) => s.blocks.map((b) => [b.id, b.movement.name] as const)));
  const perExercise = new Map<string, { done: number; skipped: number; eased: number; seated: number }>();
  for (const c of completions)
    for (const i of c.items) {
      const e = perExercise.get(i.sessionBlockId) ?? { done: 0, skipped: 0, eased: 0, seated: 0 };
      if (i.done) e.done++;
      else e.skipped++;
      if (i.eased) e.eased++;
      if (i.seated) e.seated++;
      perExercise.set(i.sessionBlockId, e);
    }
  const last = completions.at(-1);
  const feelAll = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
  for (const c of completions) if (c.feel) feelAll[c.feel]++;

  return (
    <section aria-labelledby="adh-h" className="card p-5">
      <h2 id="adh-h" className="text-2xl">
        Adherence
      </h2>
      <p className="mt-1 text-muted">
        {completions.length === 0
          ? "No sessions yet. They appear here as soon as your patient finishes one (or when their phone is back online)."
          : `${completions.length} ${completions.length === 1 ? "session" : "sessions"} so far · last on ${new Date(last!.completedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
      </p>

      <table className="mt-4 w-full text-left">
        <caption className="sr-only">Sessions completed versus planned, by week</caption>
        <thead>
          <tr className="text-sm text-muted">
            <th scope="col" className="py-1 font-semibold">
              Week of
            </th>
            <th scope="col" className="py-1 font-semibold">
              Done / planned
            </th>
            <th scope="col" className="py-1 font-semibold">
              Felt easier · same · harder
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <th scope="row" className="py-2 font-medium">
                {r.label}
                {r.current ? " (this week)" : ""}
              </th>
              <td className="py-2">
                <span className="flex items-center gap-1" aria-label={`${r.done} of ${planned}`}>
                  {Array.from({ length: Math.max(planned, r.done) }).map((_, i) => (
                    <svg key={i} viewBox="0 0 20 22" className="h-5 w-4" aria-hidden="true">
                      <polygon points="10,1 19,6 19,16 10,21 1,16 1,6" className={i < r.done ? "fill-mint stroke-teal" : "fill-none stroke-line"} strokeWidth={1.5} />
                    </svg>
                  ))}
                  <span className="ml-1 text-sm text-muted">
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

      {perExercise.size > 0 && (
        <>
          <h3 className="mt-6 font-sans text-lg font-semibold">By exercise</h3>
          <ul className="mt-2 space-y-2">
            {[...perExercise].map(([id, e]) => (
              <li key={id} className="rounded-lg bg-plaster p-3">
                <span className="block font-medium">{blocks.get(id) ?? "Removed exercise"}</span>
                <span className="block text-sm text-muted">
                  Done {e.done} · skipped {e.skipped} · made easier {e.eased} · seated version {e.seated}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
