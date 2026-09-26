import type { Metadata } from "next";
import { ProgressView } from "@/components/app/ProgressView";

export const metadata: Metadata = {
  title: "Progress",
  description: "Sessions completed this week and this month, how movement felt, and a progress summary to bring to your next visit.",
};

export default function ProgressPage() {
  return (
    <>
      <h1 className="mt-2 text-4xl">Small steps. Lasting habits.</h1>
      <ProgressView />
    </>
  );
}
