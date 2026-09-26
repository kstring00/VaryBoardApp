"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon } from "@/components/app/icons";
import { WorkoutCard } from "@/components/app/WorkoutCard";
import { t, type CopyKey } from "@/lib/copy";
import { recommendPlan, recommendWorkouts, type Answers, type Goal, type Minutes, type PlanMeta, type Position, type WorkoutMeta } from "@/lib/workout-logic";

const GOALS: Goal[] = ["reach", "strength", "balance", "stand"];
const POSITIONS: Position[] = ["standing", "seated", "either"];
const MINUTES: Minutes[] = [5, 10, 15];

function Option({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card flex min-h-16 w-full items-center justify-between gap-3 px-5 py-4 text-left text-xl font-semibold text-ink transition-colors hover:bg-mint-wash">
      {label}
      <ArrowIcon className="h-5 w-5 shrink-0 text-teal" />
    </button>
  );
}

/** Three taps to a first workout and a plan: what to work on, standing or seated, how long. */
export function FindFlow({ workouts, plans }: { workouts: WorkoutMeta[]; plans: PlanMeta[] }) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [minutes, setMinutes] = useState<Minutes | null>(null);
  const step = !goal ? 1 : !position ? 2 : !minutes ? 3 : 4;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to each new question for screen readers and keyboard users.
  useEffect(() => {
    if (step > 1) headingRef.current?.focus();
  }, [step]);

  const back = () => {
    if (minutes) setMinutes(null);
    else if (position) setPosition(null);
    else setGoal(null);
  };

  const progress = (
    <ol className="flex items-center gap-2" aria-label={`Question ${Math.min(step, 3)} of 3`}>
      {[1, 2, 3].map((i) => (
        <li key={i} aria-hidden="true">
          <svg viewBox="0 0 20 22" className="h-6 w-5">
            <polygon points="10,1 19,6 19,16 10,21 1,16 1,6" className={i < step ? "fill-mint stroke-teal" : i === step ? "fill-surface stroke-teal" : "fill-surface stroke-line"} strokeWidth={i === step ? 2.5 : 1.5} />
          </svg>
        </li>
      ))}
    </ol>
  );

  const question = (title: string, options: { label: string; pick: () => void }[]) => (
    <section className="mt-5" aria-labelledby="q-h">
      <div className="flex items-center justify-between">
        {progress}
        {step > 1 && (
          <button type="button" className="btn btn-quiet" onClick={back}>
            Back
          </button>
        )}
      </div>
      <h2 id="q-h" ref={headingRef} tabIndex={-1} className="mt-4 text-3xl outline-none">
        {title}
      </h2>
      <div className="mt-5 space-y-3">
        {options.map((o) => (
          <Option key={o.label} label={o.label} onClick={o.pick} />
        ))}
      </div>
    </section>
  );

  if (step === 1) return question(t("find.goal"), GOALS.map((g) => ({ label: t(`find.goal.${g}` as CopyKey), pick: () => setGoal(g) })));
  if (step === 2) return question(t("find.position"), POSITIONS.map((p) => ({ label: t(`find.position.${p}` as CopyKey), pick: () => setPosition(p) })));
  if (step === 3) return question(t("find.minutes"), MINUTES.map((m) => ({ label: m === 15 ? "15 minutes or more" : `About ${m} minutes`, pick: () => setMinutes(m) })));

  const answers: Answers = { goal: goal!, position: position!, minutes: minutes! };
  const [first, second] = recommendWorkouts(workouts, answers);
  const plan = recommendPlan(plans, answers);
  return (
    <section className="mt-5" aria-labelledby="r-h">
      <div className="flex items-center justify-between">
        {progress}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            setGoal(null);
            setPosition(null);
            setMinutes(null);
          }}
        >
          Start over
        </button>
      </div>
      <h2 id="r-h" ref={headingRef} tabIndex={-1} className="mt-4 text-3xl outline-none">
        {t("find.result")}
      </h2>
      {first ? (
        <>
          <div className="mt-4">
            <WorkoutCard w={first} />
          </div>
          <Link href={`/app/play/${first.slug}`} className="btn btn-primary mt-4 w-full">
            Start this workout <ArrowIcon />
          </Link>
          {second && (
            <div className="mt-6">
              <p className="font-semibold">Or try</p>
              <div className="mt-2">
                <WorkoutCard w={second} compact />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="card mt-4 p-5">
          No workout matches that yet. Dr. Eric is adding more.{" "}
          <Link href="/app/workouts" className="font-semibold text-teal underline">
            See every workout
          </Link>
        </p>
      )}
      {plan && (
        <div className="card mt-6 p-5">
          <p className="eyebrow">{t("find.planIntro")}</p>
          <p className="mt-1 font-display text-2xl leading-snug">{plan.name}</p>
          <p className="mt-1 text-muted">
            {plan.daysPerWeek} days a week · {plan.sessions} {plan.sessions === 1 ? "session" : "sessions"}
          </p>
          <Link href={`/app/starter#${plan.code}`} className="btn btn-secondary mt-4 w-full">
            See the plan
          </Link>
        </div>
      )}
      <p className="mt-6 text-sm text-muted">{t("find.note")}</p>
      <p className="mt-3 text-center">
        <Link href="/app/code" className="font-semibold text-teal underline">
          Have a code from your therapist? Enter it
        </Link>
      </p>
    </section>
  );
}
