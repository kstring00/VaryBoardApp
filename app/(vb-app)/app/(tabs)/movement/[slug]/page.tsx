import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardHero } from "@/components/BoardHero";
import { VideoPlayer } from "@/components/VideoPlayer";
import { disclaimer } from "@/content/site";
import { referencePhoto } from "@/lib/board/photo";
import { getMovement, getMovements } from "@/lib/data";
import { GENRE_NAMES } from "@/lib/genres";
import { prescription } from "@/lib/program";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getMovements()).map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/app/movement/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const m = await getMovement(slug);
  return m ? { title: m.name, description: `${GENRE_NAMES[m.genreSlug]} movement on the Vary Board: setup, cues and safety guidance.` } : {};
}

export default async function MovementPage({ params }: PageProps<"/app/movement/[slug]">) {
  const { slug } = await params;
  const m = await getMovement(slug);
  if (!m) notFound();
  const all = await getMovements();
  const seated = m.seatedAlternativeId ? all.find((x) => x.id === m.seatedAlternativeId) : null;
  return (
    <>
      <p className="mt-2">
        <Link href={`/app/library/${m.genreSlug}`} className="text-teal underline">
          {GENRE_NAMES[m.genreSlug]}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl">{m.name}</h1>
      <p className="mt-3 flex flex-wrap gap-2">
        <span className="chip">{GENRE_NAMES[m.genreSlug]}</span>
        <span className="chip">Level {m.level}</span>
        {m.needsBand && <span className="chip">Band</span>}
        {m.needsHandrail && <span className="chip">Handrails</span>}
        {m.needsChair && <span className="chip">Chair</span>}
      </p>
      <div className="mt-5">
        <VideoPlayer name={m.name} videoUrl={m.videoUrl} posterUrl={m.posterUrl} />
      </div>
      <BoardHero anchor={m.defaultAnchor} boardModels={m.boardModels} photo={referencePhoto()} callout="Suggested anchor." className="mt-5" />
      <section className="card mt-5 p-5" aria-labelledby="how-h">
        <h2 id="how-h" className="text-2xl">
          How to do it
        </h2>
        {(m.defaultSets || m.defaultReps || m.defaultHoldSeconds) && <p className="mt-1 text-muted">Typical: {prescription({ sets: m.defaultSets, reps: m.defaultReps, holdSeconds: m.defaultHoldSeconds })}. Your therapist sets yours.</p>}
        <ol className="mt-3 list-decimal space-y-2 pl-6">
          {m.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        {m.safetyNote && <p className="mt-4 rounded-xl bg-warn-bg p-3 text-warn-ink">{m.safetyNote}</p>}
        {seated && (
          <p className="mt-4">
            Seated version:{" "}
            <Link href={`/app/movement/${seated.slug}`} className="text-teal underline">
              {seated.name}
            </Link>
          </p>
        )}
      </section>
      <p className="mt-5 text-sm text-muted">{disclaimer}</p>
    </>
  );
}
