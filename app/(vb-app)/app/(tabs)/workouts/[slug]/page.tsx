import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardMap } from "@/components/BoardMap";
import { ArrowIcon } from "@/components/app/icons";
import { MinutesHex } from "@/components/app/WorkoutCard";
import { GENRE_NAMES } from "@/lib/genres";
import { prescription } from "@/lib/program";
import { equipmentLine, LEVEL_NAMES } from "@/lib/workout-logic";
import { getWorkout, getWorkoutMetas } from "@/lib/workouts";
import type { AnchorCell } from "@/lib/types";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getWorkoutMetas()).map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const w = await getWorkout((await params).slug);
  if (!w) return { title: "Workout not found" };
  return { title: `${w.meta.name} · Workout`, description: `${w.meta.blurb} ${w.meta.minutes} minutes on the Vary Board.` };
}

export default async function WorkoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const w = await getWorkout((await params).slug);
  if (!w) notFound();
  const { meta } = w;
  const blocks = w.program.sessions[0].blocks;
  const anchors = blocks.map((b) => b.anchor ?? b.movement.defaultAnchor).filter((a): a is AnchorCell => !!a);
  return (
    <>
      <p className="mt-2">
        <Link href="/app/workouts" className="font-semibold text-teal underline">
          All workouts
        </Link>
      </p>
      <div className="mt-3 flex items-start gap-4">
        <MinutesHex minutes={meta.minutes} className="h-20 w-[4.4rem]" />
        <div className="min-w-0">
          <h1 className="text-4xl">{meta.name}</h1>
          <p className="mt-2 text-lg text-muted">
            {LEVEL_NAMES[meta.level]} · {meta.exercises} exercises · {equipmentLine(meta)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-lg">{meta.blurb}</p>
      <p className="mt-3 flex flex-wrap gap-1.5">
        {meta.seated && <span className="chip bg-teal text-white">Seated</span>}
        {meta.genres.map((g) => (
          <span key={g} className="chip">
            {GENRE_NAMES[g]}
          </span>
        ))}
      </p>

      <Link href={`/app/play/${meta.slug}`} className="btn btn-primary mt-6 w-full">
        Start workout <ArrowIcon />
      </Link>

      <section aria-labelledby="ex-h" className="mt-8">
        <h2 id="ex-h" className="text-2xl">
          What you&rsquo;ll do
        </h2>
        <ol className="mt-3 space-y-3">
          {blocks.map((b, i) => (
            <li key={b.id} className="card flex items-center gap-4 p-4">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-wash font-display text-lg">
                {i + 1}
              </span>
              <span className="min-w-0">
                <Link href={`/app/movement/${b.movement.slug}`} className="block font-semibold text-ink underline decoration-line underline-offset-4">
                  {b.movement.name}
                </Link>
                <span className="text-muted">
                  {GENRE_NAMES[b.movement.genreSlug]} · {prescription(b)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {anchors.length > 0 && (
        <section aria-labelledby="board-h" className="card mt-8 p-5">
          <h2 id="board-h" className="font-sans text-lg font-semibold">
            Where you&rsquo;ll clip in
          </h2>
          <p className="mt-1 text-sm text-muted">The suggested anchors are lit. Each exercise shows its own when you get to it.</p>
          <BoardMap model="vb" litCells={anchors} crop="lit" className="mx-auto mt-4 h-72 w-auto" title="Vary Board with the suggested anchors lit" />
        </section>
      )}

      <p className="mt-6 text-sm text-muted">Stop if you feel sharp pain. If you are under a therapist&rsquo;s care, check with them before adding workouts to your plan.</p>
    </>
  );
}
