/** Shared shapes. Mirror the Postgres tables in supabase/migrations (snake_case there). */

export const GENRE_SLUGS = ["climb", "strengthen", "stretch", "loosen", "steady", "rise"] as const;
export type GenreSlug = (typeof GENRE_SLUGS)[number];

export type BoardModel = "vb" | "xt";

export interface Genre {
  id: string;
  slug: GenreSlug;
  /** The word on the button: Climb, Strengthen... */
  name: string;
  /** Eric's clinical wording: Active-Assisted Range of Motion... */
  clinicalName: string;
  description: string;
  sort: number;
}

/** One hex anchor on the board. section 1 is the bottom section, row 1 the bottom row, col 1 the left. */
export interface AnchorCell {
  section: number;
  row: number;
  col: number;
}

export interface Movement {
  id: string;
  genreSlug: GenreSlug;
  name: string;
  slug: string;
  level: 1 | 2 | 3;
  boardModels: BoardModel[];
  needsBand: boolean;
  needsHandrail: boolean;
  needsChair: boolean;
  /** Suggested anchor; the therapist's saved anchor on the session block wins. */
  defaultAnchor: AnchorCell | null;
  /** A chair-based version for people who use a chair or wheelchair. */
  seatedAlternativeId: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  cues: string[];
  safetyNote: string | null;
  /** Builder pre-fill only; the prescription lives on the session block. */
  defaultSets: number | null;
  defaultReps: number | null;
  defaultHoldSeconds: number | null;
  reviewedByEric: boolean;
  reviewedAt: string | null;
}

export interface SessionBlock {
  id: string;
  movementId: string;
  sort: number;
  sets: number | null;
  reps: number | null;
  holdSeconds: number | null;
  bandColor: string | null;
  /** The therapist's saved anchor ("Your saved anchor"). */
  anchor: AnchorCell | null;
}

export interface PlanBlock extends SessionBlock {
  movement: Movement;
  /** Embedded so the swap works offline. Null when there is none (or it is gated out). */
  seatedAlternative: Movement | null;
}

export interface PlanSession {
  id: string;
  name: string;
  sort: number;
  estMinutes: number | null;
  blocks: PlanBlock[];
}

/** A program as a patient device receives it. No clinician id. */
export interface PatientProgram {
  code: string;
  name: string;
  isStarter: boolean;
  clinicName: string | null;
  clinicPhone: string | null;
  daysPerWeek: number;
  sessions: PlanSession[];
}

/** 1 easier, 2 same, 3 harder. */
export type Feel = 1 | 2 | 3;
