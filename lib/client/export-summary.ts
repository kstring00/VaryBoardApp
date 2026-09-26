"use client";

/**
 * "Export progress summary": a one-page PDF made entirely on this device (nothing is sent
 * anywhere). Sessions, completion, how movement felt, and the patient's own notes. It includes
 * a name only if the patient typed one in Settings.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCompletions, getProfile, getProgram } from "@/lib/client/store";
import { FEEL_TEXT } from "@/lib/feel";
import { Cursor, safe } from "@/lib/pdf";
import { addDays, completionsBetween, startOfWeek } from "@/lib/progress";

const ink = rgb(0.086, 0.188, 0.169);
const muted = rgb(0.28, 0.365, 0.345);
const teal = rgb(0.118, 0.302, 0.275);

const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

export async function exportProgressSummary() {
  const program = getProgram();
  const profile = getProfile();
  const all = getCompletions();
  const now = new Date();

  const doc = await PDFDocument.create();
  doc.setTitle("Vary Board progress summary");
  doc.setCreator("Vary Board App");
  const page = doc.addPage([612, 792]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const c = new Cursor(page, 54, 740, 504);

  c.text("Vary Board progress summary", bold, 20, teal, 6);
  if (profile.firstName.trim()) c.text(`Prepared for: ${profile.firstName.trim()}`, regular, 12, ink);
  c.text(`Made ${now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} on the patient's phone.`, regular, 10, muted, 10);

  if (program) {
    c.text(`Program: ${program.name} (code ${program.code}), ${program.daysPerWeek} sessions a week planned${program.clinicName ? `, ${program.clinicName}` : ""}.`, regular, 12, ink, 10);
  }

  // Last four weeks, oldest first.
  const thisWeek = startOfWeek(now);
  c.text("Sessions completed", bold, 13, teal);
  for (let w = 3; w >= 0; w--) {
    const from = addDays(thisWeek, -7 * w);
    const cs = completionsBetween(all, from, addDays(from, 7));
    const planned = program?.daysPerWeek;
    c.text(`Week of ${fmt(from)}: ${cs.length}${planned ? ` of ${planned}` : ""} ${cs.length === 1 ? "session" : "sessions"}`, regular, 11, ink, 1);
  }
  c.space(8);

  const period = completionsBetween(all, addDays(thisWeek, -21), addDays(thisWeek, 7));
  const items = period.flatMap((x) => x.items);
  const done = items.filter((i) => i.done).length;
  const skipped = items.filter((i) => i.skipped);
  const eased = items.filter((i) => i.variant === "easier" || i.doseEased).length;
  const seated = items.filter((i) => i.variant === "seated").length;
  c.text("Exercises (last 4 weeks)", bold, 13, teal);
  c.text(`${done} of ${items.length} exercises done${items.length ? ` (${Math.round((done / items.length) * 100)}%)` : ""}. Made easier ${eased} ${eased === 1 ? "time" : "times"}. Seated version ${seated} ${seated === 1 ? "time" : "times"}. Skipped ${skipped.length}.`, regular, 11, ink, 2);
  const reasons = new Map<string, number>();
  for (const s of skipped) if (s.skipReason) reasons.set(s.skipReason, (reasons.get(s.skipReason) ?? 0) + 1);
  if (reasons.size) c.text(`Skip reasons noted: ${[...reasons].map(([r, n]) => `${r} (${n})`).join(", ")}.`, regular, 11, ink, 2);
  c.space(8);

  c.text("How did movement feel?", bold, 13, teal);
  const counts = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
  for (const x of period) if (x.feel) counts[x.feel]++;
  c.text(`Easier ${counts[1]}  ·  Same ${counts[2]}  ·  Harder ${counts[3]}`, regular, 11, ink, 4);
  for (const x of [...period].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 6)) {
    c.text(`${fmt(new Date(x.completedAt))}: ${x.sessionName}, ${x.items.filter((i) => i.done).length} of ${x.items.length} done${x.feel ? `, felt ${FEEL_TEXT[x.feel]}` : ""}`, regular, 10, muted, 0);
  }
  c.space(10);

  if (profile.notes.trim()) {
    c.text("Notes for my therapist", bold, 13, teal);
    c.text(profile.notes.trim().slice(0, 1200), regular, 11, ink, 8);
  }
  if (profile.appointment) {
    const d = new Date(profile.appointment);
    if (!Number.isNaN(d.getTime())) c.text(`Next appointment: ${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: profile.appointment.includes("T") ? "short" : undefined })}`, regular, 11, ink);
  }

  page.drawText(safe("Vary Board App · thevaryboard.com"), { x: 54, y: 40, size: 9, font: regular, color: muted });

  const bytes = await doc.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `vary-board-progress-${now.toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
