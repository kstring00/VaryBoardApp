import "server-only";
import { WORKOUTS, type SeedWorkout } from "@/content/workouts";
import { showDrafts } from "@/lib/content-gate";
import { allMovements, getStarterPrograms } from "@/lib/data";
import { metaFor, planMeta, workoutCode, type PlanMeta, type WorkoutMeta } from "@/lib/workout-logic";
import type { Movement, PatientProgram, PlanBlock } from "@/lib/types";

/**
 * Self-guided workouts, gated like everything else: production shows a workout only when it
 * and every movement in it are reviewed by Eric. Previews show drafts under the DRAFT banner.
 * A workout reaches the session player as a one-session PatientProgram with a "wk-" code, which
 * never syncs to a clinic (lib/workout-logic.ts isWorkoutCode).
 */
export interface Workout {
  meta: WorkoutMeta;
  program: PatientProgram;
}

function build(w: SeedWorkout, bySlug: Map<string, Movement>, byId: Map<string, Movement>, drafts: boolean): Workout | null {
  if (!drafts && !w.reviewedByEric) return null;
  const ok = (m: Movement | undefined | null): m is Movement => !!m && (drafts || m.reviewedByEric);
  const blocks: PlanBlock[] = [];
  for (const [i, b] of w.blocks.entries()) {
    const movement = bySlug.get(b.movementSlug);
    if (!ok(movement)) return null; // a workout is all or nothing
    const seated = movement.seatedAlternativeId ? byId.get(movement.seatedAlternativeId) : null;
    const easier = movement.easierAlternativeId ? byId.get(movement.easierAlternativeId) : null;
    blocks.push({
      id: `${w.slug}-${i + 1}`,
      movementId: movement.id,
      sort: i + 1,
      sets: b.sets,
      reps: b.reps,
      holdSeconds: b.holdSeconds,
      bandColor: b.bandColor,
      anchor: b.anchor,
      movement,
      seatedAlternative: ok(seated) ? seated : null,
      easierAlternative: ok(easier) ? easier : null,
    });
  }
  const code = workoutCode(w.slug);
  const session = { id: `${code}-1`, name: w.name, sort: 1, estMinutes: null, blocks };
  return {
    meta: metaFor(w.slug, w.name, w.blurb, w.level, session),
    program: { code, name: w.name, isStarter: true, clinicName: null, clinicPhone: null, assignedBy: null, therapistNote: null, noteUpdatedAt: null, daysPerWeek: 3, sessions: [session] },
  };
}

export async function getWorkouts(): Promise<Workout[]> {
  const movements = await allMovements();
  const bySlug = new Map(movements.map((m) => [m.slug, m]));
  const byId = new Map(movements.map((m) => [m.id, m]));
  const drafts = showDrafts();
  return WORKOUTS.map((w) => build(w, bySlug, byId, drafts)).filter((w): w is Workout => !!w);
}

export async function getWorkoutMetas(): Promise<WorkoutMeta[]> {
  return (await getWorkouts()).map((w) => w.meta);
}

export async function getWorkout(slug: string): Promise<Workout | null> {
  return (await getWorkouts()).find((w) => w.meta.slug === slug) ?? null;
}

/** Shortest workouts first, for "Quick workouts" on Today. */
export async function getQuickWorkouts(count = 3): Promise<WorkoutMeta[]> {
  return (await getWorkoutMetas())
    .map((w, i) => ({ w, i }))
    .sort((a, b) => a.w.minutes - b.w.minutes || a.w.level - b.w.level || a.i - b.i)
    .slice(0, count)
    .map((x) => x.w);
}

export async function getPlanMetas(): Promise<PlanMeta[]> {
  return (await getStarterPrograms()).map(planMeta);
}
