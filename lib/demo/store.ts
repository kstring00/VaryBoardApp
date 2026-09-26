import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { TEST_CLINICIAN, TEST_PROGRAMS } from "@/content/seed";
import { seedToRpc, type RpcProgram } from "@/lib/program-shape";
import type { AnchorCell, ExerciseEventKind } from "@/lib/types";

/**
 * LOCAL DEMO BACKEND (lib/env.ts `demoBackend`): programs, clinicians, completions, exercise
 * events and push subscriptions in server memory, so the whole app (clinician mode included)
 * runs without Supabase. Resets on restart. Never used on Vercel production or when Supabase is
 * configured. It mirrors the database rules, but the real guarantees are the RLS policies,
 * tested in tests/db.
 */

export interface DemoProgram extends RpcProgram {
  id: string;
  clinicianId: string | null;
  archived: boolean;
  createdAt: string;
}
export interface DemoCompletion {
  id: string;
  programCode: string;
  deviceId: string;
  programSessionId: string;
  completedAt: string;
  feel: number | null;
}
export interface DemoEvent {
  clientEventId: string;
  programCode: string;
  deviceId: string;
  sessionBlockId: string;
  event: ExerciseEventKind;
  occurredAt: string;
}
export interface DemoClinician {
  id: string;
  displayName: string;
  clinicName: string | null;
}
export interface DemoPush {
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  reminderLocalTime: string;
  timezone: string;
  reminderDays: number[];
  active: boolean;
  lastSentOn: string | null;
}

interface Db {
  programs: DemoProgram[];
  completions: DemoCompletion[];
  events: DemoEvent[];
  clinicians: DemoClinician[];
  push: DemoPush[];
}

const g = globalThis as { __vbDemo?: Db };

function db(): Db {
  g.__vbDemo ??= {
    programs: TEST_PROGRAMS.map((p) => ({ ...seedToRpc(p), id: p.id, clinicianId: p.clinicianId, archived: false, createdAt: new Date().toISOString() })),
    completions: [],
    events: [],
    clinicians: [{ id: TEST_CLINICIAN.id, displayName: TEST_CLINICIAN.displayName, clinicName: TEST_CLINICIAN.clinicName }],
    push: [],
  };
  return g.__vbDemo;
}

const withAssignedBy = (p: DemoProgram): DemoProgram => ({ ...p, assigned_by: p.clinicianId ? demo.clinician(p.clinicianId)?.displayName ?? null : null });
const blockOf = (p: DemoProgram, blockId: string) => p.sessions.some((s) => s.blocks.some((b) => b.id === blockId));

export const demo = {
  program(code: string): DemoProgram | null {
    const p = db().programs.find((x) => x.code === code && !x.archived);
    return p ? withAssignedBy(p) : null;
  },
  ownProgram(clinicianId: string, code: string): DemoProgram | null {
    const p = db().programs.find((x) => x.code === code && x.clinicianId === clinicianId);
    return p ? withAssignedBy(p) : null;
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
      therapistNote: string | null;
      daysPerWeek: number;
      sessions: { name: string; estMinutes: number | null; blocks: { movementId: string; sets: number | null; reps: number | null; holdSeconds: number | null; bandColor: string | null; anchor: AnchorCell | null }[] }[];
    },
  ): string {
    const d = db();
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let code = "";
    do code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
    while (d.programs.some((p) => p.code === code));
    const now = new Date().toISOString();
    d.programs.push({
      id: randomUUID(),
      clinicianId,
      archived: false,
      createdAt: now,
      code,
      is_starter: false,
      name: input.name,
      clinic_name: input.clinicName,
      clinic_phone: input.clinicPhone,
      therapist_note: input.therapistNote,
      note_updated_at: input.therapistNote ? now : null,
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
  setNote(clinicianId: string, code: string, note: string | null): boolean {
    const p = db().programs.find((x) => x.code === code && x.clinicianId === clinicianId);
    if (!p) return false;
    if (note !== p.therapist_note) p.note_updated_at = note ? new Date().toISOString() : null;
    p.therapist_note = note;
    return true;
  },
  archive(clinicianId: string, code: string): boolean {
    const p = db().programs.find((x) => x.code === code && x.clinicianId === clinicianId);
    if (!p) return false;
    p.archived = true;
    return true;
  },
  /** Mirrors the completions insert policy. */
  insertCompletion(c: DemoCompletion): "ok" | "duplicate" | "rejected" {
    const d = db();
    if (d.completions.some((x) => x.id === c.id)) return "duplicate";
    const p = demo.program(c.programCode);
    if (!p?.sessions.some((s) => s.id === c.programSessionId)) return "rejected";
    if (c.feel !== null && ![1, 2, 3].includes(c.feel)) return "rejected";
    d.completions.push(c);
    return "ok";
  },
  /** Mirrors exercise_events: unique client_event_id, active code, block of that program, plausible time. */
  insertEvent(e: DemoEvent): "ok" | "duplicate" | "rejected" {
    const d = db();
    if (d.events.some((x) => x.clientEventId === e.clientEventId)) return "duplicate";
    const p = demo.program(e.programCode);
    const t = Date.parse(e.occurredAt);
    if (!p || !blockOf(p, e.sessionBlockId) || !(t > Date.now() - 30 * 864e5 && t < Date.now() + 10 * 60e3)) return "rejected";
    d.events.push(e);
    return "ok";
  },
  completions(clinicianId: string, code: string): DemoCompletion[] {
    if (!demo.ownProgram(clinicianId, code)) return [];
    return db().completions.filter((c) => c.programCode === code);
  },
  events(clinicianId: string, code: string): DemoEvent[] {
    if (!demo.ownProgram(clinicianId, code)) return [];
    return db().events.filter((e) => e.programCode === code);
  },
  /** Test inspection only (demo backend): event counts for a code. */
  eventCounts(code: string): Record<ExerciseEventKind, number> {
    const out: Record<ExerciseEventKind, number> = { done: 0, skipped: 0, made_easier: 0 };
    for (const e of db().events) if (e.programCode === code) out[e.event]++;
    return out;
  },
  savePush(s: Omit<DemoPush, "active" | "lastSentOn">) {
    const d = db();
    const prev = d.push.find((x) => x.endpoint === s.endpoint);
    d.push = [...d.push.filter((x) => x.endpoint !== s.endpoint), { ...s, active: true, lastSentOn: prev?.lastSentOn ?? null }];
  },
  setPushActive(deviceId: string, endpoint: string, active: boolean): boolean {
    const p = db().push.find((x) => x.deviceId === deviceId && x.endpoint === endpoint);
    if (!p) return false;
    p.active = active;
    return true;
  },
  activePush(): DemoPush[] {
    return db().push.filter((p) => p.active);
  },
  markSent(endpoint: string, localDate: string) {
    const p = db().push.find((x) => x.endpoint === endpoint);
    if (p) p.lastSentOn = localDate;
  },
  deactivate(endpoint: string) {
    const p = db().push.find((x) => x.endpoint === endpoint);
    if (p) p.active = false;
  },
};
