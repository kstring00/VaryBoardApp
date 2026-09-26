import type { Metadata } from "next";
import { ProgramBuilder } from "@/components/ProgramBuilder";
import { getOwnProgram, listPrograms, requireClinician } from "@/lib/clinician";
import { getGenres, getMovements, getStarterPrograms } from "@/lib/data";
import { normalizeCode } from "@/lib/program-shape";

export const metadata: Metadata = { title: "New program", description: "Build a Vary Board program from the movement library and get a 6-character code for your patient." };
export const dynamic = "force-dynamic";

export default async function NewProgramPage({ searchParams }: PageProps<"/app/clinician/new">) {
  const c = await requireClinician();
  const from = typeof (await searchParams).from === "string" ? normalizeCode((await searchParams).from as string) : null;
  const [movements, genres, templates, mine] = await Promise.all([getMovements(), getGenres(), getStarterPrograms(), listPrograms(c)]);
  const initial = from ? (templates.find((t) => t.code === from) ?? (await getOwnProgram(c, from))?.program ?? null) : null;
  return (
    <>
      <h1 className="text-4xl">New program</h1>
      <p className="mt-2 text-lg">Pick exercises, set the dose and the anchor, and get a code for your patient.</p>
      <div className="mt-6">
        <ProgramBuilder
          key={from ?? "blank"}
          movements={movements}
          genres={genres}
          sources={[
            ...templates.map((t) => ({ code: t.code, name: t.name, kind: "template" as const })),
            ...mine.filter((p) => !p.archived).slice(0, 12).map((p) => ({ code: p.code, name: p.name, kind: "mine" as const })),
          ]}
          initial={initial}
          initialFrom={initial ? from : null}
          clinicName={c.clinicName}
        />
      </div>
    </>
  );
}
