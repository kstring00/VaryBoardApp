"use client";

import { useState } from "react";
import { WorkoutCard } from "@/components/app/WorkoutCard";
import { GENRE_NAMES } from "@/lib/genres";
import { filterWorkouts, NO_FILTERS, TIME_FILTERS, type WorkoutFilters, type WorkoutMeta } from "@/lib/workout-logic";
import type { GenreSlug } from "@/lib/types";

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center rounded-full border-2 px-4 text-base font-medium transition-colors ${on ? "border-teal bg-teal text-white" : "border-line bg-surface text-ink hover:bg-mint-wash"}`}
    >
      {children}
    </button>
  );
}

/** The workout library with filters: length, kind of movement, seated, no band. */
export function WorkoutBrowser({ workouts }: { workouts: WorkoutMeta[] }) {
  const [f, setF] = useState<WorkoutFilters>(NO_FILTERS);
  const set = (patch: Partial<WorkoutFilters>) => setF((x) => ({ ...x, ...patch }));
  const genres = (Object.keys(GENRE_NAMES) as GenreSlug[]).filter((g) => workouts.some((w) => w.genres.includes(g)));
  const shown = filterWorkouts(workouts, f);
  const filtered = f.time !== "any" || f.genre !== "any" || f.seated || f.noBand;

  return (
    <section aria-labelledby="all-h">
      <h2 id="all-h" className="text-2xl">
        All workouts
      </h2>
      <div className="mt-4 space-y-4">
        <fieldset>
          <legend className="text-sm font-semibold text-muted">Length</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIME_FILTERS.map((o) => (
              <Choice key={o.value} on={f.time === o.value} onClick={() => set({ time: o.value })}>
                {o.label}
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-muted">Kind of movement</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice on={f.genre === "any"} onClick={() => set({ genre: "any" })}>
              All
            </Choice>
            {genres.map((g) => (
              <Choice key={g} on={f.genre === g} onClick={() => set({ genre: g })}>
                {GENRE_NAMES[g]}
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-muted">Options</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice on={f.seated} onClick={() => set({ seated: !f.seated })}>
              Seated
            </Choice>
            <Choice on={f.noBand} onClick={() => set({ noBand: !f.noBand })}>
              No band needed
            </Choice>
          </div>
        </fieldset>
      </div>

      <p className="mt-5 text-muted" role="status">
        {shown.length} {shown.length === 1 ? "workout" : "workouts"}
        {filtered && (
          <>
            {" · "}
            <button type="button" className="btn btn-quiet -ml-2 px-2 align-baseline" onClick={() => setF(NO_FILTERS)}>
              Clear filters
            </button>
          </>
        )}
      </p>
      {shown.length === 0 ? (
        <p className="card mt-3 p-5">No workouts match all of those. Try a different length or clear the filters.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {shown.map((w) => (
            <li key={w.slug}>
              <WorkoutCard w={w} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
