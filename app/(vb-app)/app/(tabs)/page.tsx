import type { Metadata } from "next";
import { TodayGreeting, TodayView } from "@/components/app/TodayView";
import { referencePhoto } from "@/lib/board/photo";

export const metadata: Metadata = {
  title: { absolute: "Vary Board App: your therapist's program for the Vary Board, at home" },
  description:
    "Your program. Beyond the clinic. The companion app for the Vary Board wall-mounted training board: your therapist assigns the plan, you follow it at home, and your progress goes back to your next visit.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/app" },
};

export default function TodayPage() {
  return (
    <>
      <TodayGreeting />
      <h1 className="text-4xl text-ink">Keep your recovery moving.</h1>
      <p className="mt-2 text-muted">Your therapist&rsquo;s program for the Vary Board, at home.</p>
      <TodayView photo={referencePhoto()} />
    </>
  );
}
