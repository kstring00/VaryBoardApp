import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { allMovements } from "@/lib/data";
import { demo } from "@/lib/demo/store";
import { demoBackend, hasSupabase } from "@/lib/env";
import { fromRpc, type RpcProgram } from "@/lib/program-shape";
import { serverSupabase } from "@/lib/supabase/server";
import type { AnchorCell, PatientProgram } from "@/lib/types";

/**
 * Clinician data. Supabase (magic-link auth, RLS: a clinician only ever sees their own rows) or,
 * for local testing only, the in-memory demo backend. Nothing here ever touches patient
 * identity: clinicians see codes, sessions, done/skipped/easier and how movement felt.
 */

export const DEMO_COOKIE = "vb_demo_clinician";

export interface Clinician {
  id: string;
  email: string | null;
  displayName: string | null;
  clinicName: string | null;
  mode: "supabase" | "demo";
}

export async function getClinician(): Promise<Clinician | null> {
  if (hasSupabase) {
    const sb = (await serverSupabase())!;
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    const { data: row } = await sb.from("clinicians").select("display_name, clinic_name").eq("id", data.user.id).maybeSingle();
    return { id: data.user.id, email: data.user.email ?? null, displayName: row?.display_name ?? null, clinicName: row?.clinic_name ?? null, mode: "supabase" };
  }
  if (demoBackend) {
    const id = (await cookies()).get(DEMO_COOKIE)?.value;
    if (!id) return null;
    const c = demo.clinician(id);
    return { id, email: null, displayName: c?.displayName ?? null, clinicName: c?.clinicName ?? null, mode: "demo" };
  }
  return null;
}

/** For pages: signed in and with a profile, or redirect. */
export async function requireClinician(): Promise<Clinician & { displayName: string }> {
  const c = await getClinician();
  if (!c) redirect("/app/clinician/login");
  if (!c.displayName) redirect("/app/clinician/profile");
  return c as Clinician & { displayName: string };
}

export async function saveProfile(c: Clinician, displayName: string, clinicName: string | null): Promise<string | null> {
  if (c.mode === "demo") {
    demo.saveClinician({ id: c.id, displayName, clinicName });
    return null;
  }
  const sb = (await serverSupabase())!;
  const { error } = await sb.from("clinicians").upsert({ id: c.id, display_name: displayName, clinic_name: clinicName });
  return error ? error.message : null;
}

export interface ProgramSummary {
  code: string;
  name: string;
  daysPerWeek: number;
  sessions: number;
  createdAt: string;
  archived: boolean;
  last7: number;
}

export async function listPrograms(c: Clinician): Promise<ProgramSummary[]> {
  const weekAgo = Date.now() - 7 * 864e5;
  if (c.mode === "demo") {
    return demo.programs(c.id).map((p) => ({
      code: p.code,
      name: p.name,
      daysPerWeek: p.days_per_week,
      sessions: p.sessions.length,
      createdAt: p.createdAt,
      archived: p.archived,
      last7: demo.completions(c.id, p.code).filter((x) => Date.parse(x.completedAt) > weekAgo).length,
    }));
  }
  const sb = (await serverSupabase())!;
  const { data, error } = await sb
    .from("programs")
    .select("code, name, days_per_week, created_at, archived, program_sessions(count)")
    .eq("clinician_id", c.id)
    .order("created_at", { ascending: false });
  if (error || !data) throw new Error(`Could not load programs: ${error?.message}`);
  const codes = data.map((p) => p.code);
  const recent = codes.length
    ? ((await sb.from("completions").select("program_code").in("program_code", codes).gt("completed_at", new Date(weekAgo).toISOString())).data ?? [])
    : [];
  return data.map((p) => ({
    code: p.code,
    name: p.name,
    daysPerWeek: p.days_per_week,
    sessions: (p.program_sessions as unknown as { count: number }[])[0]?.count ?? 0,
    createdAt: p.created_at,
    archived: p.archived,
    last7: recent.filter((r) => r.program_code === p.code).length,
  }));
}

export interface OwnProgram {
  program: PatientProgram;
  archived: boolean;
  createdAt: string;
}

export async function getOwnProgram(c: Clinician, code: string): Promise<OwnProgram | null> {
  const movements = await allMovements();
  if (c.mode === "demo") {
    const p = demo.ownProgram(c.id, code);
    return p ? { program: fromRpc(p, movements), archived: p.archived, createdAt: p.createdAt } : null;
  }
  const sb = (await serverSupabase())!;
  const { data } = await sb
    .from("programs")
    .select("code, name, clinic_name, clinic_phone, days_per_week, archived, created_at, reviewed_by_eric, program_sessions(id, name, sort, est_minutes, session_blocks(id, movement_id, sort, sets, reps, hold_seconds, band_color, anchor))")
    .eq("code", code)
    .eq("clinician_id", c.id)
    .maybeSingle();
  if (!data) return null;
  type S = { id: string; name: string; sort: number; est_minutes: number | null; session_blocks: RpcProgram["sessions"][number]["blocks"] };
  const rp: RpcProgram = {
    code: data.code,
    is_starter: false,
    name: data.name,
    clinic_name: data.clinic_name,
    clinic_phone: data.clinic_phone,
    reviewed_by_eric: data.reviewed_by_eric,
    days_per_week: data.days_per_week,
    sessions: (data.program_sessions as S[])
      .sort((a, b) => a.sort - b.sort)
      .map((s) => ({ id: s.id, name: s.name, sort: s.sort, est_minutes: s.est_minutes, blocks: [...s.session_blocks].sort((a, b) => a.sort - b.sort) })),
  };
  return { program: fromRpc(rp, movements), archived: data.archived, createdAt: data.created_at };
}

export interface AdherenceCompletion {
  id: string;
  programSessionId: string;
  completedAt: string;
  feel: number | null;
  items: { sessionBlockId: string; done: boolean; eased: boolean; seated: boolean }[];
}

export async function getCompletions(c: Clinician, code: string): Promise<AdherenceCompletion[]> {
  if (c.mode === "demo") return demo.completions(c.id, code).map((x) => ({ id: x.id, programSessionId: x.programSessionId, completedAt: x.completedAt, feel: x.feel, items: x.items }));
  const sb = (await serverSupabase())!;
  const { data, error } = await sb
    .from("completions")
    .select("id, program_session_id, completed_at, feel, completion_items(session_block_id, done, eased, seated)")
    .eq("program_code", code)
    .order("completed_at");
  if (error || !data) throw new Error(`Could not load sessions: ${error?.message}`);
  return data.map((r) => ({
    id: r.id,
    programSessionId: r.program_session_id,
    completedAt: r.completed_at,
    feel: r.feel,
    items: (r.completion_items as { session_block_id: string; done: boolean; eased: boolean; seated: boolean }[]).map((i) => ({ sessionBlockId: i.session_block_id, done: i.done, eased: i.eased, seated: i.seated })),
  }));
}

export interface NewProgram {
  name: string;
  clinicName: string | null;
  clinicPhone: string | null;
  daysPerWeek: number;
  sessions: { name: string; estMinutes: number | null; blocks: { movementId: string; sets: number | null; reps: number | null; holdSeconds: number | null; bandColor: string | null; anchor: AnchorCell | null }[] }[];
}

export async function createProgram(c: Clinician, p: NewProgram): Promise<{ code: string } | { error: string }> {
  if (c.mode === "demo") return { code: demo.createProgram(c.id, p) };
  const sb = (await serverSupabase())!;
  const { data, error } = await sb.rpc("create_program", {
    p_name: p.name,
    p_clinic_name: p.clinicName,
    p_clinic_phone: p.clinicPhone,
    p_days_per_week: p.daysPerWeek,
    p_sessions: p.sessions.map((s) => ({
      name: s.name,
      est_minutes: s.estMinutes,
      blocks: s.blocks.map((b) => ({ movement_id: b.movementId, sets: b.sets, reps: b.reps, hold_seconds: b.holdSeconds, band_color: b.bandColor, anchor: b.anchor })),
    })),
  });
  if (error || !data) return { error: error?.message ?? "Could not create the program." };
  return { code: data as string };
}

export async function archiveProgram(c: Clinician, code: string): Promise<boolean> {
  if (c.mode === "demo") return demo.archive(c.id, code);
  const sb = (await serverSupabase())!;
  const { error, count } = await sb.from("programs").update({ archived: true }, { count: "exact" }).eq("code", code).eq("clinician_id", c.id);
  return !error && (count ?? 0) > 0;
}
