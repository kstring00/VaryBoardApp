import type { Metadata } from "next";
import { StartFlow } from "@/components/app/StartFlow";

export const metadata: Metadata = {
  title: "When will you move?",
  description: "Pick the moment in your day for your Vary Board session and commit to your plan.",
};

/** First code entry: habit anchor, then commitment, then an optional reminder. One screen each. */
export default function StartPage() {
  return <StartFlow />;
}
