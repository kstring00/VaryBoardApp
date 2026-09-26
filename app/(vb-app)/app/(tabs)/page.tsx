import type { Metadata } from "next";
import { TodayGreeting, TodayView } from "@/components/app/TodayView";
import { referencePhoto } from "@/lib/board/photo";
import { getQuickWorkouts } from "@/lib/workouts";

export const metadata: Metadata = {
  title: { absolute: "Vary Board App: your therapist's program for the Vary Board, at home" },
  description:
    "Your program. Beyond the clinic. The companion app for the Vary Board wall-mounted training board: your therapist assigns the plan, you follow it at home, and your progress goes back to your next visit.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/app" },
};

// Static on purpose: an ISR /app (the PWA start page) leaves a service-worker navigation request
// hanging. Today refreshes the quick workouts from /app/api/workouts/quick instead.

export default async function TodayPage() {
  const quick = await getQuickWorkouts();
  return (
    <>
      <TodayGreeting />
      <h1 className="text-4xl text-ink">Keep your recovery moving.</h1>
      <p className="mt-2 text-muted">Your therapist&rsquo;s program and follow-along workouts for the Vary Board, at home.</p>
      <TodayView photo={referencePhoto()} quick={quick} />
    </>
  );
}
