import type { Metadata } from "next";
import Link from "next/link";
import { listPrograms, requireClinician } from "@/lib/clinician";

export const metadata: Metadata = { title: "Your programs", description: "Programs you have built and the codes you gave your patients." };
export const dynamic = "force-dynamic";

export default async function ClinicianHome() {
  const c = await requireClinician();
  const programs = await listPrograms(c);
  const active = programs.filter((p) => !p.archived);
  const archived = programs.filter((p) => p.archived);
  return (
    <>
      <p className="eyebrow">{c.clinicName ?? "Clinician"}</p>
      <h1 className="mt-1 text-4xl">Your programs</h1>
      <p className="mt-2 text-lg">Hello, {c.displayName}. Each program has one code for one patient.</p>
      <Link href="/app/clinician/new" className="btn btn-primary mt-6 w-full sm:w-auto">
        New program
      </Link>
      {active.length === 0 ? (
        <p className="card mt-6 p-5">No programs yet. Start from Dr. Eric&rsquo;s starter template and you will have a code in under two minutes.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {active.map((p) => (
            <li key={p.code} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <Link href={`/app/clinician/${p.code}`} className="min-h-12 flex-1 text-ink no-underline">
                <span className="block font-display text-xl">{p.name}</span>
                <span className="block text-muted">
                  Code <span className="font-semibold tracking-widest text-ink">{p.code}</span> · {p.sessions} {p.sessions === 1 ? "session" : "sessions"} · {p.daysPerWeek}/week · {p.last7} done in the last 7 days
                </span>
              </Link>
              <Link href={`/app/clinician/new?from=${p.code}`} className="btn btn-quiet">
                Duplicate
              </Link>
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="min-h-12 cursor-pointer py-2 font-semibold">Archived ({archived.length})</summary>
          <ul className="mt-2 space-y-2">
            {archived.map((p) => (
              <li key={p.code}>
                <Link href={`/app/clinician/${p.code}`} className="text-teal underline">
                  {p.name} ({p.code})
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-10 text-sm text-muted">
        <Link href="/app/clinician/profile" className="underline">
          Edit your profile
        </Link>
      </p>
    </>
  );
}
