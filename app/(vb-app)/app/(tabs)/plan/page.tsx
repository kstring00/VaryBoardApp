import type { Metadata } from "next";
import { PlanView } from "@/components/app/PlanView";

export const metadata: Metadata = {
  title: "My plan",
  description: "Your Vary Board program: the sessions your therapist assigned and the exercises in each, grouped by genre.",
};

export default function PlanPage() {
  return <PlanView />;
}
