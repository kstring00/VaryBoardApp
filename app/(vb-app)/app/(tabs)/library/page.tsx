import type { Metadata } from "next";
import Link from "next/link";
import { HexNav } from "@/components/HexNav";
import { getGenres, getMovements } from "@/lib/data";
import type { GenreSlug } from "@/lib/types";

export const metadata: Metadata = {
  title: "Movement library",
  description: "The six kinds of movement on the Vary Board: Climb, Strengthen, Stretch, Loosen, Steady and Rise.",
};
export const revalidate = 300;

export default async function LibraryPage() {
  const [genres, movements] = await Promise.all([getGenres(), getMovements()]);
  const counts: Partial<Record<GenreSlug, number>> = {};
  for (const m of movements) counts[m.genreSlug] = (counts[m.genreSlug] ?? 0) + 1;
  return (
    <>
      <h1 className="mt-2 text-4xl">Movement library</h1>
      <p className="mt-2 text-lg">Six kinds of movement on one board. Your therapist picks from these for your plan.</p>
      <div className="mt-6">
        <HexNav genres={genres} counts={counts} />
      </div>
      <ul className="mt-6 space-y-3">
        {genres.map((g) => (
          <li key={g.slug}>
            <Link href={`/app/library/${g.slug}`} className="card flex min-h-16 flex-col justify-center p-4 text-ink no-underline hover:bg-mint-wash">
              <span className="font-display text-xl">
                {g.name} <span className="font-sans text-base text-muted">· {g.clinicalName}</span>
              </span>
              <span className="text-sm text-muted">{counts[g.slug] ? `${counts[g.slug]} ${counts[g.slug] === 1 ? "movement" : "movements"}` : "Coming soon"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
