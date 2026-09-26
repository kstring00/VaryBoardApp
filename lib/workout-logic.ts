/**
 * Self-guided workouts: pure helpers shared by the server pages, the browser filters and the
 * "Find your starting point" questions. Tested in tests/workouts.test.ts.
 */
import { sessionMinutes } from "@/lib/program";
import type { GenreSlug, Movement, PatientProgram, PlanSession } from "@/lib/types";

/** Workouts run in the session player under this code prefix and never sync to a clinic. */
export const WORKOUT_CODE_PREFIX = "wk-";
export const workoutCode = (slug: string) => `${WORKOUT_CODE_PREFIX}${slug}`;
export const isWorkoutCode = (code: string) => code.startsWith(WORKOUT_CODE_PREFIX);

export interface WorkoutMeta {
  slug: string;
  name: string;
  blurb: string;
  level: 1 | 2 | 3;
  minutes: number;
  exercises: number;
  /** The kinds of movement in it, in order of first appearance. */
  genres: GenreSlug[];
  /** Every exercise is done sitting in a chair. */
  seated: boolean;
  needsBand: boolean;
  needsRails: boolean;
  needsChair: boolean;
}

/**
 * Done from a chair: the movement needs a chair, or it needs no rails and has no seated
 * version (so it is not a standing movement). A workout is seated when every movement is, and
 * at least one needs the chair.
 */
export function sitCompatible(m: Pick<Movement, "needsChair" | "needsHandrail" | "seatedAlternativeId">): boolean {
  return m.needsChair ? !m.needsHandrail : !m.needsHandrail && !m.seatedAlternativeId;
}
export function allSeated(mv: Pick<Movement, "needsChair" | "needsHandrail" | "seatedAlternativeId">[]): boolean {
  return mv.some((m) => m.needsChair) && mv.every(sitCompatible);
}

export function metaFor(slug: string, name: string, blurb: string, level: 1 | 2 | 3, session: PlanSession): WorkoutMeta {
  const mv = session.blocks.map((b) => b.movement);
  const genres: GenreSlug[] = [];
  for (const m of mv) if (!genres.includes(m.genreSlug)) genres.push(m.genreSlug);
  return {
    slug,
    name,
    blurb,
    level,
    minutes: sessionMinutes(session),
    exercises: session.blocks.length,
    genres,
    seated: allSeated(mv),
    needsBand: mv.some((m) => m.needsBand),
    needsRails: mv.some((m) => m.needsHandrail),
    needsChair: mv.some((m) => m.needsChair),
  };
}

/** "Band · Rails · Chair", or "Just the board". */
export function equipmentLine(w: Pick<WorkoutMeta, "needsBand" | "needsRails" | "needsChair">): string {
  const xs = [w.needsBand && "Band", w.needsRails && "Rails", w.needsChair && "Chair"].filter(Boolean) as string[];
  return xs.length ? xs.join(" · ") : "Just the board";
}

export const LEVEL_NAMES: Record<1 | 2 | 3, string> = { 1: "Gentle", 2: "Moderate", 3: "Challenging" };

export type TimeFilter = "any" | "short" | "medium" | "long";
export const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: "any", label: "Any length" },
  { value: "short", label: "Under 5 min" },
  { value: "medium", label: "5–10 min" },
  { value: "long", label: "10+ min" },
];

export interface WorkoutFilters {
  time: TimeFilter;
  genre: GenreSlug | "any";
  seated: boolean;
  noBand: boolean;
}
export const NO_FILTERS: WorkoutFilters = { time: "any", genre: "any", seated: false, noBand: false };

export function inTime(minutes: number, t: TimeFilter): boolean {
  if (t === "short") return minutes < 5;
  if (t === "medium") return minutes >= 5 && minutes <= 10;
  if (t === "long") return minutes > 10;
  return true;
}

export function filterWorkouts(all: WorkoutMeta[], f: WorkoutFilters): WorkoutMeta[] {
  return all.filter((w) => inTime(w.minutes, f.time) && (f.genre === "any" || w.genres.includes(f.genre)) && (!f.seated || w.seated) && (!f.noBand || !w.needsBand));
}

/* ---- Find your starting point ------------------------------------------------------------ */

export type Goal = "reach" | "strength" | "balance" | "stand";
export type Position = "standing" | "seated" | "either";
export type Minutes = 5 | 10 | 15;

export const GOAL_GENRES: Record<Goal, GenreSlug[]> = {
  reach: ["climb", "stretch"],
  strength: ["strengthen"],
  balance: ["steady"],
  stand: ["rise"],
};

export interface Answers {
  goal: Goal;
  position: Position;
  minutes: Minutes;
}

/**
 * Best workouts for the answers: seated answers only ever get seated workouts; then genre match,
 * then fitting the time, then gentler first. Deterministic (ties keep library order).
 */
export function recommendWorkouts(all: WorkoutMeta[], a: Answers, count = 2): WorkoutMeta[] {
  const pool = a.position === "seated" ? all.filter((w) => w.seated) : a.position === "standing" ? all.filter((w) => !w.seated) : all;
  const want = GOAL_GENRES[a.goal];
  const score = (w: WorkoutMeta) => {
    const hits = w.genres.filter((g) => want.includes(g)).length;
    const lead = want.includes(w.genres[0]) ? 1 : 0;
    const fits = w.minutes <= a.minutes ? 2 : w.minutes <= a.minutes + 3 ? 0 : -3;
    return hits * 3 + lead * 2 + fits - (w.level - 1);
  };
  return pool
    .map((w, i) => ({ w, i, s: score(w) }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .slice(0, count)
    .map((x) => x.w);
}

export interface PlanMeta {
  code: string;
  name: string;
  daysPerWeek: number;
  sessions: number;
  seated: boolean;
}

export function planMeta(p: PatientProgram): PlanMeta {
  const mv = p.sessions.flatMap((s) => s.blocks.map((b) => b.movement));
  return { code: p.code, name: p.name, daysPerWeek: p.daysPerWeek, sessions: p.sessions.length, seated: allSeated(mv) };
}

/** A multi-day plan to follow after the first workout: the seated plan for seated answers, else the longest plan. */
export function recommendPlan(plans: PlanMeta[], a: Answers): PlanMeta | null {
  if (!plans.length) return null;
  if (a.position === "seated") return plans.find((p) => p.seated) ?? null;
  const pool = plans.filter((p) => !p.seated);
  return [...(pool.length ? pool : plans)].sort((x, y) => y.sessions - x.sessions)[0] ?? null;
}
