import type { AnchorCell, BoardModel, GenreSlug, Movement, PatientProgram, PlanSession } from "@/lib/types";
import { MOVEMENTS, type SeedProgram } from "@/content/seed";

/** Row shapes from Supabase and the mapping into app types. Shared by lib/data and lib/clinician. */

export interface MovementRow {
  id: string;
  name: string;
  slug: string;
  level: number;
  board_models: string[];
  needs_band: boolean;
  needs_handrail: boolean;
  needs_chair: boolean;
  default_anchor: AnchorCell | null;
  seated_alternative_id: string | null;
  video_url: string | null;
  poster_url: string | null;
  cues: string[] | null;
  safety_note: string | null;
  default_sets: number | null;
  default_reps: number | null;
  default_hold_seconds: number | null;
  reviewed_by_eric: boolean;
  reviewed_at: string | null;
  genres: { slug: GenreSlug } | null;
}

export const MOVEMENT_COLUMNS =
  "id, name, slug, level, board_models, needs_band, needs_handrail, needs_chair, default_anchor, seated_alternative_id, video_url, poster_url, cues, safety_note, default_sets, default_reps, default_hold_seconds, reviewed_by_eric, reviewed_at, genres(slug)";

export function toMovement(r: MovementRow): Movement {
  return {
    id: r.id,
    genreSlug: r.genres?.slug ?? "climb",
    name: r.name,
    slug: r.slug,
    level: Math.min(3, Math.max(1, r.level)) as 1 | 2 | 3,
    boardModels: r.board_models.filter((x): x is BoardModel => x === "vb" || x === "xt"),
    needsBand: r.needs_band,
    needsHandrail: r.needs_handrail,
    needsChair: r.needs_chair,
    defaultAnchor: r.default_anchor && typeof r.default_anchor === "object" ? r.default_anchor : null,
    seatedAlternativeId: r.seated_alternative_id,
    videoUrl: r.video_url || null,
    posterUrl: r.poster_url || null,
    cues: r.cues ?? [],
    safetyNote: r.safety_note,
    defaultSets: r.default_sets,
    defaultReps: r.default_reps,
    defaultHoldSeconds: r.default_hold_seconds,
    reviewedByEric: r.reviewed_by_eric,
    reviewedAt: r.reviewed_at,
  };
}

/** get_program() JSON. */
export interface RpcProgram {
  code: string;
  is_starter: boolean;
  name: string;
  clinic_name: string | null;
  clinic_phone: string | null;
  reviewed_by_eric: boolean;
  days_per_week: number;
  sessions: {
    id: string;
    name: string;
    sort: number;
    est_minutes: number | null;
    blocks: { id: string; movement_id: string; sort: number; sets: number | null; reps: number | null; hold_seconds: number | null; band_color: string | null; anchor: AnchorCell | null }[];
  }[];
}

export type RawProgram = PatientProgram & { reviewedByEric: boolean };

export function fromRpc(rp: RpcProgram, movements: Movement[]): RawProgram {
  const byId = new Map(movements.map((m) => [m.id, m]));
  const sessions: PlanSession[] = rp.sessions.map((s) => ({
    id: s.id,
    name: s.name,
    sort: s.sort,
    estMinutes: s.est_minutes,
    blocks: s.blocks.flatMap((b) => {
      const movement = byId.get(b.movement_id);
      if (!movement) return [];
      const seated = movement.seatedAlternativeId ? byId.get(movement.seatedAlternativeId) ?? null : null;
      return [{ id: b.id, movementId: b.movement_id, sort: b.sort, sets: b.sets, reps: b.reps, holdSeconds: b.hold_seconds, bandColor: b.band_color, anchor: b.anchor ?? null, movement, seatedAlternative: seated }];
    }),
  }));
  return {
    code: rp.code,
    name: rp.name,
    isStarter: rp.is_starter,
    clinicName: rp.clinic_name,
    clinicPhone: rp.clinic_phone,
    daysPerWeek: rp.days_per_week,
    reviewedByEric: rp.reviewed_by_eric,
    sessions,
  };
}

/** A seed program in get_program() shape. */
export function seedToRpc(p: SeedProgram): RpcProgram {
  const mid = (slug: string) => MOVEMENTS.find((m) => m.slug === slug)!.id;
  return {
    code: p.code,
    is_starter: p.clinicianId === null,
    name: p.name,
    clinic_name: p.clinicName,
    clinic_phone: p.clinicPhone,
    reviewed_by_eric: p.reviewedByEric,
    days_per_week: p.daysPerWeek,
    sessions: p.sessions.map((s, si) => ({
      id: s.id,
      name: s.name,
      sort: si + 1,
      est_minutes: s.estMinutes,
      blocks: s.blocks.map((b, bi) => ({ id: b.id, movement_id: mid(b.movementSlug), sort: bi + 1, sets: b.sets, reps: b.reps, hold_seconds: b.holdSeconds, band_color: b.bandColor, anchor: b.anchor })),
    })),
  };
}

export const CODE_PATTERN = /^[A-Z0-9]{6}$/;
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
