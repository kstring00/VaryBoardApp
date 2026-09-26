import type { Metadata } from "next";
import Link from "next/link";
import { UseStarterButton } from "@/components/app/UseStarterButton";
import { eric } from "@/content/site";
import { getStarterPrograms } from "@/lib/data";
import { exerciseCount, sessionMinutes } from "@/lib/program";

export const metadata: Metadata = {
  title: "Starter plans",
  description: "Starter plans for the Vary Board from Dr. Eric Santiago, PT, DPT, for when you do not have a code from a therapist yet.",
};
export const revalidate = 300;

export default async function StarterPage() {
  const plans = await getStarterPrograms();
  return (
    <>
      <h1 className="mt-2 text-4xl">Starter plans</h1>
      <p className="mt-2 text-lg">
        From {eric.name}, {eric.credentials}. A plan from your own therapist is always the better fit: enter their code in Care when you have it.
      </p>
      {plans.length === 0 ? (
        <div className="card mt-6 p-5">
          <p className="text-lg">Starter plans from Dr. Eric are coming soon.</p>
          <Link href="/app/code" className="btn btn-secondary mt-4 w-full">
            Enter a therapist&rsquo;s code
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {plans.map((p) => (
            <li key={p.code} className="card p-5">
              <h2 className="text-2xl">{p.name}</h2>
              <p className="mt-1 text-muted">
                {p.daysPerWeek} days a week · {p.sessions.map((s) => `${s.name}: ${sessionMinutes(s)} min, ${exerciseCount(s)}`).join("; ")}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-6">
                {p.sessions.flatMap((s) => s.blocks).map((b) => (
                  <li key={b.id}>{b.movement.name}</li>
                ))}
              </ul>
              <UseStarterButton program={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
