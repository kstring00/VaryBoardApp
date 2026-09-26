import "server-only";
import { GENRES, MOVEMENTS, STARTER_PROGRAMS, TEST_PROGRAMS } from "@/content/seed";
import { gateMovements, gateProgram, showDrafts } from "@/lib/content-gate";
import { demo } from "@/lib/demo/store";
import { demoBackend } from "@/lib/env";
import { CODE_PATTERN, MOVEMENT_COLUMNS, fromRpc, normalizeCode, seedToRpc, toMovement, type MovementRow, type RpcProgram } from "@/lib/program-shape";
import { publicSupabase } from "@/lib/supabase/public";
import type { Genre, Movement, PatientProgram } from "@/lib/types";

/**
 * Content access. Supabase when configured, the built-in seed otherwise. Everything that
 * reaches a page goes through the ContentGate.
 */

export async function getGenres(): Promise<Genre[]> {
  const sb = publicSupabase();
  if (!sb) return GENRES;
  const { data, error } = await sb.from("genres").select("id, slug, name, clinical_name, description, sort").order("sort");
  if (error || !data) throw new Error(`Could not load genres: ${error?.message}`);
  return data.map((g) => ({ id: g.id, slug: g.slug, name: g.name, clinicalName: g.clinical_name, description: g.description, sort: g.sort }));
}

/** Every movement, before the gate. Internal: pages only ever see gated lists. */
export async function allMovements(): Promise<Movement[]> {
  const sb = publicSupabase();
  if (!sb) return MOVEMENTS;
  const { data, error } = await sb.from("movements").select(MOVEMENT_COLUMNS).order("name");
  if (error || !data) throw new Error(`Could not load movements: ${error?.message}`);
  return (data as unknown as MovementRow[]).map(toMovement);
}

export async function getMovements(): Promise<Movement[]> {
  const genres = await getGenres();
  const order = new Map(genres.map((g) => [g.slug, g.sort]));
  return gateMovements(await allMovements()).sort(
    (a, b) => (order.get(a.genreSlug) ?? 0) - (order.get(b.genreSlug) ?? 0) || a.level - b.level || a.name.localeCompare(b.name),
  );
}

export async function getMovement(slug: string): Promise<Movement | null> {
  return (await getMovements()).find((m) => m.slug === slug) ?? null;
}

/** Programs known without Supabase: Eric's starter plan, the test code on previews, demo programs. */
function localRpc(code: string): RpcProgram | null {
  const starter = STARTER_PROGRAMS.find((p) => p.code === code);
  if (starter) return seedToRpc(starter);
  if (demoBackend) return demo.program(code);
  if (showDrafts()) {
    const test = TEST_PROGRAMS.find((p) => p.code === code);
    if (test) return seedToRpc(test);
  }
  return null;
}

async function rawProgram(code: string): Promise<RpcProgram | null> {
  const sb = publicSupabase();
  if (!sb) return localRpc(code);
  const { data, error } = await sb.rpc("get_program", { p_code: code });
  if (error) throw new Error(`Could not load program: ${error.message}`);
  return (data as RpcProgram | null) ?? null;
}

/** A program as a patient device sees it, gated. Null for unknown, archived or fully gated programs. */
export async function getPatientProgram(rawCode: string): Promise<PatientProgram | null> {
  const code = normalizeCode(rawCode);
  if (!CODE_PATTERN.test(code)) return null;
  const rp = await rawProgram(code);
  if (!rp) return null;
  return gateProgram(fromRpc(rp, await allMovements()));
}

export async function getStarterPrograms(): Promise<PatientProgram[]> {
  const sb = publicSupabase();
  let codes: string[];
  if (!sb) codes = STARTER_PROGRAMS.map((p) => p.code);
  else {
    const { data, error } = await sb.from("programs").select("code").is("clinician_id", null).eq("archived", false).order("code");
    if (error || !data) throw new Error(`Could not load starter plans: ${error?.message}`);
    codes = data.map((r) => r.code);
  }
  const out: PatientProgram[] = [];
  for (const c of codes) {
    const p = await getPatientProgram(c);
    if (p) out.push(p);
  }
  return out;
}
