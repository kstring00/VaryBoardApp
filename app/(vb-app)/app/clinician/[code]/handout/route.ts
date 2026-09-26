import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { brand, disclaimer } from "@/content/site";
import { getClinician, getOwnProgram } from "@/lib/clinician";
import { siteUrl } from "@/lib/env";
import { describePattern } from "@/lib/board/geometry";
import { GENRE_NAMES } from "@/lib/genres";
import { Cursor, safe } from "@/lib/pdf";
import { normalizeCode } from "@/lib/program-shape";
import { prescription } from "@/lib/program";

const ink = rgb(0.086, 0.188, 0.169);
const muted = rgb(0.28, 0.365, 0.345);
const teal = rgb(0.118, 0.302, 0.275);
const mint = rgb(0.384, 0.733, 0.651);

/**
 * One-page patient handout: the code, a QR code to /app/code?c=CODE, three steps, and the plan.
 * No patient details: only the program and the clinician's own name and clinic.
 */
export async function GET(_req: Request, ctx: RouteContext<"/app/clinician/[code]/handout">) {
  const c = await getClinician();
  if (!c) return NextResponse.redirect(new URL("/app/clinician/login", siteUrl()));
  const code = normalizeCode((await ctx.params).code);
  const own = await getOwnProgram(c, code);
  if (!own) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const p = own.program;

  const doc = await PDFDocument.create();
  doc.setTitle(`Vary Board program ${p.code}`);
  doc.setCreator("Vary Board App");
  const page = doc.addPage([612, 792]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // QR code, drawn module by module (vector, sharp when printed).
  const link = `${siteUrl()}/app/code?c=${p.code}`;
  const qr = QRCode.create(link, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const box = 150;
  const cell = box / size;
  const qx = 612 - 54 - box;
  const qy = 792 - 54 - box;
  page.drawRectangle({ x: qx - 6, y: qy - 6, width: box + 12, height: box + 12, color: rgb(1, 1, 1), borderColor: mint, borderWidth: 1.5 });
  for (let r = 0; r < size; r++)
    for (let col = 0; col < size; col++)
      if (qr.modules.get(r, col)) page.drawRectangle({ x: qx + col * cell, y: qy + box - (r + 1) * cell, width: cell + 0.2, height: cell + 0.2, color: ink });

  const c1 = new Cursor(page, 54, 792 - 54, 612 - 54 * 2 - box - 24);
  c1.text("Your Vary Board program", bold, 22, teal, 6);
  c1.text(p.name, regular, 14, ink, 14);
  c1.text("Your code", regular, 11, muted, 0);
  page.drawText(p.code.split("").join(" "), { x: 54, y: c1.y - 34, size: 34, font: bold, color: ink });
  c1.space(48);
  c1.text(`Prepared by ${c.displayName ?? "your therapist"}${p.clinicName ? `, ${p.clinicName}` : ""}${p.clinicPhone ? `. Clinic phone: ${p.clinicPhone}` : ""}.`, regular, 11, ink);

  const c2 = new Cursor(page, 54, Math.min(c1.y, qy - 24), 504);
  c2.text("Getting started", bold, 14, teal, 2);
  c2.text(`1. On your phone, scan the QR code or open ${safe(siteUrl().replace(/^https?:\/\//, ""))}/app/code`, regular, 11, ink, 0);
  c2.text(`2. Enter the code ${p.code} and tap "Use this plan".`, regular, 11, ink, 0);
  c2.text("3. On Today, tap Start session. Your board setup, timer and steps are in the app.", regular, 11, ink, 0);
  c2.text("Tip: add the app to your home screen (Share, then Add to Home Screen) so it opens like any other app.", regular, 10, muted, 10);

  c2.text(`Your plan: ${p.daysPerWeek} sessions a week`, bold, 14, teal, 2);
  for (const s of p.sessions) {
    c2.text(`${s.name}${s.estMinutes ? ` (about ${s.estMinutes} min)` : ""}`, bold, 11, ink, 0);
    s.blocks.forEach((b, i) => {
      const anchor = b.anchor ? `; anchor: ${describePattern([b.anchor], b.anchor.section > 3 ? "xt" : "vb")[0]}` : "";
      c2.text(`${i + 1}. ${b.movement.name} (${GENRE_NAMES[b.movement.genreSlug]}): ${prescription(b)}${b.bandColor ? `, ${b.bandColor} band` : ""}${anchor}`, regular, 10, ink, 0);
    });
    c2.space(6);
  }
  c2.text("Before each session: check the band for nicks or tears, make sure the carabiner is closed on the anchor, and stop if you feel sharp pain.", regular, 10, ink, 2);
  c2.text(disclaimer, regular, 9, muted, 2);

  page.drawText(safe(`Vary Board support: ${brand.phone} · ${brand.domain}`), { x: 54, y: 40, size: 9, font: regular, color: muted });

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vary-board-program-${p.code}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
