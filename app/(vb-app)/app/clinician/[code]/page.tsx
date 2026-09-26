import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { AdherenceCard } from "@/components/AdherenceCard";
import { GENRE_NAMES } from "@/lib/genres";
import { getCompletions, getOwnProgram, requireClinician } from "@/lib/clinician";
import { siteUrl } from "@/lib/env";
import { describePattern } from "@/lib/board/geometry";
import { normalizeCode } from "@/lib/program-shape";
import { prescription } from "@/lib/program";
import { archiveProgramAction } from "../actions";

export const metadata: Metadata = { title: "Program and adherence", description: "A program's code, handout and adherence." };
export const dynamic = "force-dynamic";

export default async function ProgramPage({ params, searchParams }: PageProps<"/app/clinician/[code]">) {
  const c = await requireClinician();
  const code = normalizeCode((await params).code);
  const own = await getOwnProgram(c, code);
  if (!own) notFound();
  const { created } = await searchParams;
  const completions = await getCompletions(c, code);
  const p = own.program;
  const link = `${siteUrl()}/app/code?c=${p.code}`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#16302b", light: "#ffffff" } });
  return (
    <>
      <p>
        <Link href="/app/clinician" className="text-teal underline">
          Your programs
        </Link>
      </p>
      {created && (
        <p role="status" className="mt-4 rounded-xl bg-mint-wash p-4 font-semibold text-teal">
          Program created. Give your patient the code or the printed handout.
        </p>
      )}
      <h1 className="mt-3 text-4xl">{p.name}</h1>
      <p className="mt-1 text-lg text-muted">
        {p.daysPerWeek} sessions a week{p.clinicName ? ` · ${p.clinicName}` : ""}
        {own.archived ? " · archived" : ""}
      </p>

      <section aria-labelledby="code-h" className="card mt-6 grid gap-5 p-5 sm:grid-cols-[1fr_10rem]">
        <div>
          <h2 id="code-h" className="text-2xl">
            Patient code
          </h2>
          <p className="mt-2 font-display text-5xl tracking-[0.2em]">{p.code}</p>
          <p className="mt-2 text-muted">The patient enters this in the app (Care, or {siteUrl().replace(/^https?:\/\//, "")}/app/code), or scans the QR code.</p>
          <a href={`/app/clinician/${p.code}/handout`} className="btn btn-primary mt-4 w-full sm:w-auto">
            Print handout (PDF)
          </a>
        </div>
        <div className="mx-auto w-40" role="img" aria-label={`QR code that opens the app with code ${p.code}`} dangerouslySetInnerHTML={{ __html: qr }} />
      </section>

      <div className="mt-6">
        <AdherenceCard program={p} completions={completions} />
      </div>

      <section aria-labelledby="plan-h" className="card mt-6 p-5">
        <h2 id="plan-h" className="text-2xl">
          What the patient sees
        </h2>
        {p.sessions.map((s) => (
          <div key={s.id} className="mt-4">
            <h3 className="font-sans text-lg font-semibold">
              {s.name}
              {s.estMinutes ? ` · ${s.estMinutes} min` : ""}
            </h3>
            <ol className="mt-1 list-decimal space-y-1 pl-6">
              {s.blocks.map((b) => (
                <li key={b.id}>
                  {b.movement.name} <span className="text-muted">({GENRE_NAMES[b.movement.genreSlug]})</span> · {prescription(b)}
                  {b.bandColor ? ` · ${b.bandColor} band` : ""}
                  {b.anchor ? ` · ${describePattern([b.anchor], b.anchor.section > 3 ? "xt" : "vb")[0]}` : ""}
                </li>
              ))}
            </ol>
          </div>
        ))}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/app/clinician/new?from=${p.code}`} className="btn btn-secondary">
            Duplicate and edit
          </Link>
          {!own.archived && (
            <form action={archiveProgramAction.bind(null, p.code)}>
              <button type="submit" className="btn btn-quiet">
                Archive (the code stops working)
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
