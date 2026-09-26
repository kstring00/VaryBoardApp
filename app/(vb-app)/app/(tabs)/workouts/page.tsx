import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/app/icons";
import { WorkoutBrowser } from "@/components/app/WorkoutBrowser";
import { eric } from "@/content/site";
import { t } from "@/lib/copy";
import { getStarterPrograms } from "@/lib/data";
import { getWorkoutMetas } from "@/lib/workouts";

export const metadata: Metadata = {
  title: "Workouts",
  description: "Follow-along Vary Board workouts from Dr. Eric Santiago, PT, DPT: filter by length, kind of movement, seated or no band.",
};
export const revalidate = 300;

export default async function WorkoutsPage() {
  const [workouts, plans] = await Promise.all([getWorkoutMetas(), getStarterPrograms()]);
  return (
    <>
      <h1 className="mt-2 text-4xl">Workouts</h1>
      <p className="mt-2 text-lg">{t("workouts.intro")}</p>

      <section aria-labelledby="find-h" className="mt-6 rounded-2xl border border-line bg-mint-wash p-5 shadow-soft">
        <h2 id="find-h" className="text-2xl">
          {t("workouts.findTitle")}
        </h2>
        <p className="mt-1">{t("workouts.findBody")}</p>
        <Link href="/app/find" className="btn btn-primary mt-4 w-full">
          {t("find.title")} <ArrowIcon />
        </Link>
      </section>

      {plans.length > 0 && (
        <section aria-labelledby="plans-h" className="mt-8">
          <h2 id="plans-h" className="text-2xl">
            Programs
          </h2>
          <p className="mt-1 text-muted">A few days a week, one session at a time. From {eric.name}.</p>
          <ul className="mt-3 space-y-3">
            {plans.map((p) => (
              <li key={p.code}>
                <Link href={`/app/starter#${p.code}`} className="card flex min-h-16 items-center justify-between gap-3 p-4 text-ink no-underline hover:bg-mint-wash">
                  <span>
                    <span className="block font-display text-xl leading-snug">{p.name}</span>
                    <span className="text-sm text-muted">
                      {p.daysPerWeek} days a week · {p.sessions.length} {p.sessions.length === 1 ? "session" : "sessions"}
                    </span>
                  </span>
                  <ArrowIcon className="h-5 w-5 shrink-0 text-teal" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8">
        {workouts.length ? (
          <WorkoutBrowser workouts={workouts} />
        ) : (
          <p className="card p-5 text-lg">Workouts from Dr. Eric are coming soon.</p>
        )}
      </div>

      <p className="mt-8 text-center">
        <Link href="/app/library" className="font-semibold text-teal underline">
          Browse every movement
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-muted">{t("workouts.codeNote")}</p>
    </>
  );
}
