import type { Metadata } from "next";
import { FindFlow } from "@/components/app/FindFlow";
import { t } from "@/lib/copy";
import { getPlanMetas, getWorkoutMetas } from "@/lib/workouts";

export const metadata: Metadata = {
  title: "Find your starting point",
  description: "Three quick questions to find a first Vary Board workout and a plan to follow: what to work on, standing or seated, and how much time you have.",
};
export const revalidate = 300;

export default async function FindPage() {
  const [workouts, plans] = await Promise.all([getWorkoutMetas(), getPlanMetas()]);
  return (
    <>
      <h1 className="mt-2 text-4xl">{t("find.title")}</h1>
      <FindFlow workouts={workouts} plans={plans} />
    </>
  );
}
