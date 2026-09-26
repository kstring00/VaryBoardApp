import "server-only";
import type { Movement, PatientProgram, PlanSession } from "@/lib/types";
import { vercelEnv } from "@/lib/env";

/**
 * ContentGate. Production never shows a movement Eric has not reviewed.
 *
 *   next dev (NODE_ENV=development) .......... drafts shown
 *   Vercel production (VERCEL_ENV=production)  drafts hidden, always
 *   Vercel preview ............................ drafts shown under a DRAFT banner so Eric can
 *                                               review them (VB_HIDE_DRAFTS=true hides them)
 *   any other production build (next start) ... drafts hidden unless VB_SHOW_DRAFTS=true
 *
 * `pnpm content:audit` separately fails when a published program references a draft.
 */
export function showDrafts(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (vercelEnv === "production") return false;
  if (vercelEnv === "preview") return process.env.VB_HIDE_DRAFTS !== "true";
  return process.env.VB_SHOW_DRAFTS === "true";
}

export function gateMovements(movements: Movement[]): Movement[] {
  return showDrafts() ? movements : movements.filter((m) => m.reviewedByEric);
}

/**
 * Drops exercises whose movement is gated out (and gated seated alternatives), then empty
 * sessions. A starter plan must itself be reviewed. Null when nothing is left.
 */
export function gateProgram(p: PatientProgram & { reviewedByEric?: boolean }): PatientProgram | null {
  const drafts = showDrafts();
  if (p.isStarter && !p.reviewedByEric && !drafts) return null;
  const ok = (m: Movement | null) => !!m && (drafts || m.reviewedByEric);
  const sessions: PlanSession[] = p.sessions
    .map((s) => ({ ...s, blocks: s.blocks.filter((b) => ok(b.movement)).map((b) => ({ ...b, seatedAlternative: ok(b.seatedAlternative) ? b.seatedAlternative : null, easierAlternative: ok(b.easierAlternative) ? b.easierAlternative : null })) }))
    .filter((s) => s.blocks.length > 0);
  if (!sessions.length) return null;
  return {
    code: p.code,
    name: p.name,
    isStarter: p.isStarter,
    clinicName: p.clinicName,
    clinicPhone: p.clinicPhone,
    assignedBy: p.assignedBy,
    therapistNote: p.therapistNote,
    noteUpdatedAt: p.noteUpdatedAt,
    daysPerWeek: p.daysPerWeek,
    sessions,
  };
}
