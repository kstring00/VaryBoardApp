import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { TEST_CLINICIAN, TEST_PROGRAMS } from "@/content/seed";
import { seedToRpc, type RpcProgram } from "@/lib/program-shape";
import type { AnchorCell } from "@/lib/types";

/**
 * LOCAL DEMO BACKEND (lib/env.ts `demoBackend`): programs, clinicians and completions in
 * server memory, so the whole app (including clinician mode) can be exercised without
 * Supabase. Resets on restart. Never used on Vercel production or when Supabase is configured.
 * It mirrors the database rules (active codes, sessions of the program, owner-only reads), but
 * the real guarantees are the RLS policies, tested in tests/db.
 */

export interface DemoProgram extends RpcProgram {
  id: string;
  clinicianId: string | null;
  archived: boolean;
  createdAt: string;
}
export interface DemoCompletionItem {
  id: string;
  sessionBlockId: string;
  done: boolean;
  eased: boolean;
  seated: boolean;
}
export interface DemoCompletion {
  id: string;
  programCode: string;
  deviceId: string;
  programSessionId: string;
  completedAt: string;
  feel: number | null;
  items: DemoCompletionItem[];
}
export interface DemoClinician {
  id: string;
  displayName: string;
  clinicName: string | null;
}

interface Db {
  programs: DemoProgram[];
  completions: DemoCompletion[];
  clinicians: DemoClinician[];
}

const g = globalThis as { __vbDemo?: Db };

function db(): Db {
  g.__vbDemo ??= {
    programs: TEST_PROGRAMS.map((p) => ({ ...seedToRpc(p), id: p.id, clinicianId: p.clinicianId, archived: false, createdAt: new Date().toISOString() })),
    completions: [],
    clinicians: [{ id: TEST_CLINICIAN.id, displayName: TEST_CLINICIAN.displayName, clinicName: TEST_CLINICIAN.clinicName }],
  };
  return g.__vbDemo;
}

export const demo = {
  program(code: string): DemoProgram | null {
    return db().programs.find((p) => p.code === code && !p.archived) ?? null;
  },
  ownProgram(clinicianId: string, code: string): DemoProgram | null {
    return db().programs.find((p) => p.code === code && p.clinicianId === clinicianId) ?? null;
  },
  programs(clinicianId: string): DemoProgram[] {
    return db().programs.filter((p) => p.clinicianId === clinicianId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  clinician(id: string): DemoClinician | null {
    return db().clinicians.find((c) => c.id === id) ?? null;
  },
  saveClinician(c: DemoClinician) {
    const d = db();
    d.clinicians = [...d.clinicians.filter((x) => x.id !== c.id), c];
  },
  createProgram(
    clinicianId: string,
    input: {
      name: string;
      clinicName: string | null;
      clinicPhone: string | null;
      daysPerWeek: number;
      sessions: { name: string; estMinutes: number | null; blocks: { movementId: string; sets: number | null; reps: number | null; holdSeconds: number | null; bandColor: string | null; anchor: AnchorCell | null }[] }[];
    },
  ): string {
    const d = db();
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let code = "";
    do code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
    while (d.programs.some((p) => p.code === code));
    d.programs.push({
      id: randomUUID(),
      clinicianId,
      archived: false,
      createdAt: new Date().toISOString(),
      code,
      is_starter: false,
      name: input.name,
      clinic_name: input.clinicName,
      clinic_phone: input.clinicPhone,
      reviewed_by_eric: false,
      days_per_week: input.daysPerWeek,
      sessions: input.sessions.map((s, si) => ({
        id: randomUUID(),
        name: s.name,
        sort: si + 1,
        est_minutes: s.estMinutes,
        blocks: s.blocks.map((b, bi) => ({ id: randomUUID(), movement_id: b.movementId, sort: bi + 1, sets: b.sets, reps: b.reps, hold_seconds: b.holdSeconds, band_color: b.bandColor, anchor: b.anchor })),
      })),
    });
    return code;
  },
  archive(clinicianId: string, code: string): boolean {
    const p = db().programs.find((x) => x.code === code && x.clinicianId === clinicianId);
    if (!p) return false;
    p.archived = true;
    return true;
  },
  /** Mirrors the insert policies: active code, a session of that program, blocks of that session. */
  insertCompletion(c: DemoCompletion): "ok" | "duplicate" | "rejected" {
    const d = db();
    if (d.completions.some((x) => x.id === c.id)) return "duplicate";
    const p = demo.program(c.programCode);
    const session = p?.sessions.find((s) => s.id === c.programSessionId);
    if (!session) return "rejected";
    if (c.feel !== null && ![1, 2, 3].includes(c.feel)) return "rejected";
    if (!c.items.every((i) => session.blocks.some((b) => b.id === i.sessionBlockId))) return "rejected";
    d.completions.push(c);
    return "ok";
  },
  completions(clinicianId: string, code: string): DemoCompletion[] {
    if (!demo.ownProgram(clinicianId, code)) return [];
    return db().completions.filter((c) => c.programCode === code);
  },
};
