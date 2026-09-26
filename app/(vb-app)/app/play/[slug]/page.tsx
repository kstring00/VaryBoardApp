import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SessionPlayer } from "@/components/SessionPlayer";
import { referencePhoto } from "@/lib/board/photo";
import { getWorkout } from "@/lib/workouts";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const w = await getWorkout((await params).slug);
  return { title: w ? `Playing: ${w.meta.name}` : "Workout not found", description: "Follow along one exercise at a time, with a timer that counts every rep and hold." };
}

/** A self-guided workout in the same player as the plan, in its own slot (never sent to a clinic). */
export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const w = await getWorkout((await params).slug);
  if (!w) notFound();
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <SessionPlayer photo={referencePhoto()} workout={w.program} />
    </Suspense>
  );
}
