import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MovementList } from "@/components/app/MovementList";
import { getGenres, getMovements } from "@/lib/data";
import { GENRE_SLUGS, type GenreSlug } from "@/lib/types";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return GENRE_SLUGS.map((genre) => ({ genre }));
}

export async function generateMetadata({ params }: PageProps<"/app/library/[genre]">): Promise<Metadata> {
  const { genre } = await params;
  const g = (await getGenres()).find((x) => x.slug === genre);
  return g ? { title: `${g.name}: ${g.clinicalName}`, description: `${g.name} (${g.clinicalName}) movements for the Vary Board. ${g.description}` } : {};
}

export default async function GenrePage({ params }: PageProps<"/app/library/[genre]">) {
  const { genre } = await params;
  if (!GENRE_SLUGS.includes(genre as GenreSlug)) notFound();
  const g = (await getGenres()).find((x) => x.slug === genre);
  if (!g) notFound();
  const movements = (await getMovements()).filter((m) => m.genreSlug === g.slug);
  return (
    <>
      <p className="mt-2">
        <Link href="/app/library" className="text-teal underline">
          Movement library
        </Link>
      </p>
      <h1 className="mt-2 text-4xl">{g.name}</h1>
      <p className="text-lg text-muted">{g.clinicalName}</p>
      <p className="mt-2 text-lg">{g.description}</p>
      {movements.length === 0 ? (
        <p className="card mt-6 p-5 text-lg">No {g.name} movements are published yet. Dr. Eric is preparing them.</p>
      ) : (
        <MovementList movements={movements} />
      )}
    </>
  );
}
