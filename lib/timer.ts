/**
 * The exercise timer is built from the therapist's prescription (sets x reps x hold), never from
 * the video. Hands are on the board, so it runs on its own: each rep is a hold (or a 4-second
 * pace when there is no hold), a short relax between holds, a rest between sets.
 */
export interface Step {
  kind: "hold" | "rep" | "relax" | "rest";
  seconds: number;
  set: number;
  rep: number;
}

export const PACE_SECONDS = 4;
export const RELAX_SECONDS = 3;
export const REST_SECONDS = 20;

export function buildSteps(dose: { sets: number | null; reps: number | null; holdSeconds: number | null }): Step[] {
  const sets = Math.max(1, dose.sets ?? 1);
  const reps = dose.reps ? Math.max(1, dose.reps) : 1;
  const hold = dose.holdSeconds ?? 0;
  const out: Step[] = [];
  for (let s = 1; s <= sets; s++) {
    for (let r = 1; r <= reps; r++) {
      if (hold) {
        out.push({ kind: "hold", seconds: hold, set: s, rep: r });
        if (r < reps) out.push({ kind: "relax", seconds: RELAX_SECONDS, set: s, rep: r });
      } else out.push({ kind: "rep", seconds: PACE_SECONDS, set: s, rep: r });
    }
    if (s < sets) out.push({ kind: "rest", seconds: REST_SECONDS, set: s, rep: reps });
  }
  return out;
}

export function totalSeconds(steps: Step[]): number {
  return steps.reduce((t, s) => t + s.seconds, 0);
}
