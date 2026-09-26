import type { Metadata } from "next";
import { Suspense } from "react";
import { CodeEntry } from "@/components/app/CodeEntry";

export const metadata: Metadata = {
  title: "Enter your therapist's code",
  description: "Enter the 6-character code from your physical therapist to load your Vary Board plan.",
};

/** Target of the handout QR code (/app/code?c=XXXXXX). */
export default function CodePage() {
  return (
    <>
      <h1 className="mt-2 text-4xl">Enter your therapist&rsquo;s code</h1>
      <p className="mt-3 text-lg">Six letters and numbers, on the handout from your physical therapist.</p>
      <Suspense fallback={<div className="mt-8 h-64" />}>
        <CodeEntry />
      </Suspense>
    </>
  );
}
