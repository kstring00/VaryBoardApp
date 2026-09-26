import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionPlayer } from "@/components/SessionPlayer";
import { referencePhoto } from "@/lib/board/photo";

export const metadata: Metadata = {
  title: "Session",
  description: "Follow today's Vary Board session one exercise at a time: set up your board, then move with a timer that follows your therapist's plan.",
};

export default function SessionPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <SessionPlayer photo={referencePhoto()} />
    </Suspense>
  );
}
