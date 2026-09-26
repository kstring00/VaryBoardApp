import type { PlanBlock, PlanSession, SessionBlock } from "@/lib/types";

type Dose = Pick<SessionBlock, "sets" | "reps" | "holdSeconds">;

/** "2 sets of 10, hold 5 s" — the therapist's prescription, in words. */
export function prescription(b: Dose): string {
  const sets = b.sets ?? 1;
  if (b.holdSeconds && !b.reps) return sets > 1 ? `Hold ${b.holdSeconds} s, ${sets} times` : `Hold ${b.holdSeconds} s`;
  const reps = b.reps ?? 1;
  const hold = b.holdSeconds ? `, hold ${b.holdSeconds} s` : "";
  return sets > 1 ? `${sets} sets of ${reps}${hold}` : `${reps} ${reps === 1 ? "rep" : "reps"}${hold}`;
}

/** "Make it easier": one step down, never below one rep, one set or one second. */
export function easierDose(b: Dose): Dose {
  return {
    sets: b.sets && b.sets > 1 ? b.sets - 1 : b.sets,
    reps: b.reps ? Math.max(1, Math.round(b.reps * 0.7)) : b.reps,
    holdSeconds: b.holdSeconds ? Math.max(1, Math.round(b.holdSeconds * 0.7)) : b.holdSeconds,
  };
}

/** The spoken name: drafts drop their "[DRAFT] Genre — " prefix. */
export function spokenName(name: string): string {
  return name.replace(/^\[DRAFT\]\s*/, "").replace(/^[A-Za-z]+\s+—\s+/, "");
}

/** "Wall climb, 10 reps, hold 5" — the audio cue follows the prescription, never the video. */
export function spokenCue(name: string, b: Dose): string {
  const parts = [spokenName(name)];
  if (b.reps) parts.push(`${b.reps} ${b.reps === 1 ? "rep" : "reps"}`);
  if (b.holdSeconds) parts.push(b.reps ? `hold ${b.holdSeconds}` : `hold ${b.holdSeconds} seconds`);
  if (b.sets && b.sets > 1) parts.push(`${b.sets} sets`);
  return parts.join(", ");
}

/** Seconds counted per rep when there is no hold (the brief's formula needs a hold). */
export const SECONDS_PER_REP_WITHOUT_HOLD = 3;
export const SETUP_SECONDS = 20;
/** Sessions longer than this are flagged in the builder: short sessions are easier to keep. */
export const LONG_SESSION_MINUTES = 15;
export const WARN_EXERCISES = 5;
export const MAX_EXERCISES = 6;

/** Estimated seconds: sum of sets x reps x hold, plus 20 s setup per exercise. */
export function estimateSeconds(blocks: Dose[]): number {
  return blocks.reduce((t, b) => t + (b.sets ?? 1) * (b.reps ?? 1) * (b.holdSeconds ?? SECONDS_PER_REP_WITHOUT_HOLD) + SETUP_SECONDS, 0);
}

/** Session length: the therapist's number if set, else the estimate. */
export function sessionMinutes(s: Pick<PlanSession, "estMinutes" | "blocks">): number {
  if (s.estMinutes) return s.estMinutes;
  return Math.max(1, Math.ceil(estimateSeconds(s.blocks) / 60));
}

export function exerciseCount(s: PlanSession): string {
  return `${s.blocks.length} ${s.blocks.length === 1 ? "exercise" : "exercises"}`;
}

/** Exercises grouped by genre, in first-appearance order (My plan). */
export function byGenre(blocks: PlanBlock[]): { genre: PlanBlock["movement"]["genreSlug"]; blocks: PlanBlock[] }[] {
  const out: { genre: PlanBlock["movement"]["genreSlug"]; blocks: PlanBlock[] }[] = [];
  for (const b of blocks) {
    const g = out.find((x) => x.genre === b.movement.genreSlug);
    if (g) g.blocks.push(b);
    else out.push({ genre: b.movement.genreSlug, blocks: [b] });
  }
  return out;
}
