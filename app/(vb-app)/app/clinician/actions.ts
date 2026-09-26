"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TEST_CLINICIAN } from "@/content/seed";
import { DEMO_COOKIE, archiveProgram, createProgram, getClinician, saveProfile, updateNote, type NewProgram } from "@/lib/clinician";
import { getMovements } from "@/lib/data";
import { demoBackend, hasSupabase, siteUrl } from "@/lib/env";
import { isValidCell } from "@/lib/board/geometry";
import { LABEL_MAX, labelProblem, noteProblem, phoneProblem } from "@/lib/labels";
import { MAX_EXERCISES } from "@/lib/program";
import { serverSupabase } from "@/lib/supabase/server";

export interface FormState {
  ok?: boolean;
  message?: string;
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : siteUrl();
}

/** Magic link. Email is collected for clinicians only (never for patients). */
export async function sendMagicLink(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { message: "Enter a valid work email address." };
  const sb = await serverSupabase();
  if (!sb) return { message: "Clinician sign-in is not configured on this deployment." };
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${await origin()}/app/auth/callback?next=/app/clinician`, shouldCreateUser: true } });
  if (error) return { message: "We couldn't send the link just now. Please try again in a minute." };
  return { ok: true, message: `Check ${email} for a sign-in link. It works once and expires in an hour.` };
}

/** Local demo backend only: sign in as the seeded test clinician. */
export async function demoSignIn() {
  if (!demoBackend) redirect("/app/clinician/login");
  (await cookies()).set(DEMO_COOKIE, TEST_CLINICIAN.id, { httpOnly: true, sameSite: "lax", path: "/app", secure: process.env.NODE_ENV === "production" && !(await headers()).get("host")?.startsWith("localhost") });
  redirect("/app/clinician");
}

export async function signOut() {
  if (hasSupabase) await (await serverSupabase())!.auth.signOut();
  (await cookies()).delete(DEMO_COOKIE);
  redirect("/app/clinician/login");
}

export async function saveProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await getClinician();
  if (!c) redirect("/app/clinician/login");
  const displayName = String(form.get("displayName") ?? "").trim();
  const clinicName = String(form.get("clinicName") ?? "").trim() || null;
  if (!displayName || displayName.length > 80) return { message: "Enter your name as patients know you (80 characters max)." };
  if (clinicName && clinicName.length > 80) return { message: "Clinic name: 80 characters max." };
  const err = await saveProfile(c, displayName, clinicName);
  if (err) return { message: "Could not save your profile. Please try again." };
  redirect("/app/clinician");
}

const int = (v: unknown, lo: number, hi: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : NaN;
};

/** Validates everything again on the server (the database checks it a third time). */
export async function createProgramAction(input: NewProgram): Promise<{ code?: string; error?: string }> {
  const c = await getClinician();
  if (!c?.displayName) return { error: "Please sign in again." };

  const name = String(input.name ?? "").trim();
  const nameErr = labelProblem(name, LABEL_MAX.program);
  if (nameErr) return { error: `Program name: ${nameErr}` };
  const clinicName = String(input.clinicName ?? "").trim() || null;
  if (clinicName) {
    const e = labelProblem(clinicName, LABEL_MAX.clinic);
    if (e) return { error: `Clinic name: ${e}` };
  }
  const clinicPhone = String(input.clinicPhone ?? "").trim() || null;
  const phoneErr = clinicPhone ? phoneProblem(clinicPhone) : null;
  if (phoneErr) return { error: `Clinic phone: ${phoneErr}` };
  const therapistNote = String(input.therapistNote ?? "").trim() || null;
  const noteErr = therapistNote ? noteProblem(therapistNote) : null;
  if (noteErr) return { error: `Note: ${noteErr}` };
  const days = int(input.daysPerWeek, 1, 7);
  if (!days) return { error: "Sessions a week: 1 to 7." };
  if (!Array.isArray(input.sessions) || input.sessions.length < 1 || input.sessions.length > 7) return { error: "Add 1 to 7 sessions." };

  const allowed = new Set((await getMovements()).map((m) => m.id));
  const sessions: NewProgram["sessions"] = [];
  for (const [i, s] of input.sessions.entries()) {
    const sName = String(s.name ?? "").trim();
    const e = labelProblem(sName, LABEL_MAX.session);
    if (e) return { error: `Session ${i + 1} name: ${e}` };
    const est = int(s.estMinutes, 1, 180);
    if (Number.isNaN(est)) return { error: `Session ${i + 1}: minutes 1 to 180.` };
    if (!Array.isArray(s.blocks) || s.blocks.length < 1 || s.blocks.length > MAX_EXERCISES) return { error: `Session ${i + 1}: add 1 to ${MAX_EXERCISES} exercises.` };
    const blocks: NewProgram["sessions"][number]["blocks"] = [];
    for (const [j, b] of s.blocks.entries()) {
      const where = `Session ${i + 1}, exercise ${j + 1}`;
      if (!allowed.has(b.movementId)) return { error: `${where}: that movement is not available.` };
      const sets = int(b.sets, 1, 10);
      const reps = int(b.reps, 1, 50);
      const hold = int(b.holdSeconds, 1, 600);
      if ([sets, reps, hold].some((x) => Number.isNaN(x))) return { error: `${where}: sets 1-10, reps 1-50, hold 1-600 seconds.` };
      if (!reps && !hold) return { error: `${where}: set reps, a hold time, or both.` };
      const band = String(b.bandColor ?? "").trim() || null;
      if (band && !/^[A-Za-z][A-Za-z ]{0,15}$/.test(band)) return { error: `${where}: band color in letters only (16 max).` };
      if (b.anchor && !isValidCell(b.anchor, "xt")) return { error: `${where}: that anchor is not on the board.` };
      blocks.push({ movementId: b.movementId, sets, reps, holdSeconds: hold, bandColor: band, anchor: b.anchor ? { section: b.anchor.section, row: b.anchor.row, col: b.anchor.col } : null });
    }
    sessions.push({ name: sName, estMinutes: est, blocks });
  }

  const r = await createProgram(c, { name, clinicName, clinicPhone, therapistNote, daysPerWeek: days, sessions });
  if ("error" in r) return { error: /check constraint/i.test(r.error) ? "One of the names was not accepted. Remove any patient names, emails or numbers." : "Could not create the program. Please try again." };
  revalidatePath("/app/clinician");
  return { code: r.code };
}

export async function archiveProgramAction(code: string) {
  const c = await getClinician();
  if (!c) redirect("/app/clinician/login");
  await archiveProgram(c, code);
  revalidatePath("/app/clinician");
  redirect("/app/clinician");
}

/** The therapist note shown under the patient's session card (120 characters, no identifiers). */
export async function updateNoteAction(code: string, _prev: FormState, form: FormData): Promise<FormState> {
  const c = await getClinician();
  if (!c) redirect("/app/clinician/login");
  const note = String(form.get("note") ?? "").trim() || null;
  const err = note ? noteProblem(note) : null;
  if (err) return { message: err };
  const ok = await updateNote(c, code, note);
  if (!ok) return { message: "Could not save the note. Please try again." };
  revalidatePath(`/app/clinician/${code}`);
  return { ok: true, message: note ? "Saved. Your patient sees it the next time the app opens online." : "Note removed." };
}
