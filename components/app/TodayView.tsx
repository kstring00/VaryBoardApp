"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppointmentRow } from "@/components/AppointmentRow";
import { HexWeekRow } from "@/components/HexCharts";
import { SessionCard } from "@/components/SessionCard";
import { ArrowIcon } from "@/components/app/icons";
import { WorkoutCard } from "@/components/app/WorkoutCard";
import { setProgram, useActive, useActiveWorkout, useCompletions, useHabit, useOutboxCount, useProfile, useProgram } from "@/lib/client/store";
import { flushEvents } from "@/lib/client/events";
import { flushOutbox } from "@/lib/client/submit";
import { disableReminders, syncReminderText } from "@/lib/client/reminders";
import { t } from "@/lib/copy";
import { completionsBetween, nextSession, weekDots, weekRange } from "@/lib/progress";
import type { PatientProgram } from "@/lib/types";
import { WORKOUT_CODE_PREFIX, type WorkoutMeta } from "@/lib/workout-logic";

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function TodayGreeting() {
  const profile = useProfile();
  // The greeting depends on the phone's clock, so it is only rendered on the device.
  const hello = useSyncExternalStore(
    () => () => {},
    () => greeting(new Date()),
    () => null,
  );
  const name = profile?.firstName.trim();
  return <p className="min-h-7 text-lg text-muted">{hello ? `${hello}${name ? `, ${name}` : ""}` : " "}</p>;
}

export function TodayView({ photo, quick: initialQuick = [] }: { photo: string | null; quick?: WorkoutMeta[] }) {
  const [quick, setQuick] = useState(initialQuick);
  // The page is static; refresh the list quietly (offline keeps the built one).
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/app/api/workouts/quick", { signal: ctrl.signal })
      .then(async (r) => (r.ok ? setQuick((await r.json()) as WorkoutMeta[]) : undefined))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  const program = useProgram();
  const completions = useCompletions();
  const active = useActive();
  const workoutActive = useActiveWorkout();
  const pending = useOutboxCount();
  const habit = useHabit();
  const [ended, setEnded] = useState(false);
  const [now] = useState(() => new Date());

  // Keep the stored plan fresh (quietly; offline keeps the stored copy) and sync saved sessions.
  useEffect(() => {
    void flushOutbox();
    void flushEvents();
    if (!program) return;
    const ctrl = new AbortController();
    fetch(`/app/api/program/${program.code}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) setEnded(true);
        else if (r.ok) {
          const fresh = (await r.json()) as PatientProgram;
          if (JSON.stringify(fresh) !== JSON.stringify(program)) setProgram(fresh);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.code]);

  const nextName = program && completions ? nextSession(program, completions).name : null;
  useEffect(() => {
    if (program !== undefined) syncReminderText(nextName);
  }, [nextName, program]);

  if (program === undefined || completions === undefined) {
    return <div className="mt-6 h-80 animate-pulse rounded-2xl bg-surface" aria-busy="true" aria-label="Loading your plan" />;
  }

  const [from, to] = weekRange(now);
  const weekAll = completionsBetween(completions, from, to);
  // With a plan, the count toward the plan is plan sessions only; workouts are shown alongside.
  const thisWeek = program ? weekAll.filter((c) => c.kind !== "workout").length : weekAll.length;
  const weekWorkouts = program ? weekAll.length - thisWeek : 0;
  const resumeWorkout = workoutActive && workoutActive.phase !== "done" ? workoutActive : null;
  const committed = !!program && habit?.programCode === program.code && !!habit.committedAt;

  return (
    <div className="mt-6 space-y-5">
      {program ? (
        (() => {
          const resuming = active && active.programCode === program.code && active.phase !== "done" ? active : null;
          const session = (resuming && program.sessions.find((s) => s.id === resuming.programSessionId)) || nextSession(program, completions);
          return (
            <>
              <SessionCard program={program} session={session} photo={photo} resume={resuming ? { index: resuming.index, total: resuming.queue.length } : null} />
              {program.therapistNote && (
                <figure className="border-l-4 border-mint pl-4">
                  <blockquote className="font-display text-lg italic leading-snug text-ink">&ldquo;{program.therapistNote}&rdquo;</blockquote>
                  <figcaption className="mt-1 text-sm text-muted">
                    {t("today.noteLabel")}
                    {program.assignedBy ? `, ${program.assignedBy}` : ""}
                  </figcaption>
                </figure>
              )}
            </>
          );
        })()
      ) : (
        <section aria-labelledby="no-plan-h" className="rounded-2xl border border-line bg-mint-wash p-5 shadow-soft">
          <p className="eyebrow">Get started</p>
          <h2 id="no-plan-h" className="mt-1 text-3xl">
            {t("today.startTitle")}
          </h2>
          <p className="mt-2">{t("today.startBody")}</p>
          <Link href="/app/find" className="btn btn-primary mt-6 w-full">
            {t("find.title")} <ArrowIcon />
          </Link>
          <Link href="/app/code" className="btn btn-secondary mt-3 w-full">
            Enter your therapist&rsquo;s code
          </Link>
        </section>
      )}

      {resumeWorkout && (
        <Link href={`/app/play/${resumeWorkout.programCode.slice(WORKOUT_CODE_PREFIX.length)}`} className="card flex min-h-16 items-center justify-between gap-3 p-4 text-ink no-underline hover:bg-mint-wash">
          <span>
            <span className="eyebrow block">Workout in progress</span>
            <span className="font-display text-xl">{resumeWorkout.sessionName}</span>
            <span className="block text-sm text-muted">
              Exercise {resumeWorkout.index + 1} of {resumeWorkout.queue.length} is next
            </span>
          </span>
          <ArrowIcon className="h-5 w-5 shrink-0 text-teal" />
        </Link>
      )}

      {ended && (
        <p role="status" className="rounded-xl bg-warn-bg p-4 text-warn-ink">
          This plan has ended. Ask your therapist for a new code, then enter it in Care.
        </p>
      )}

      <section aria-labelledby="week-h" className="card p-5">
        <div>
          <h2 id="week-h" className="font-sans text-lg font-semibold">
            Weekly activity
          </h2>
          <p className="mt-1 text-muted">
            {program && committed ? (
              <span className="font-semibold text-ink">{t("today.weekPlan", { done: thisWeek, days: program.daysPerWeek })}</span>
            ) : program ? (
              <>
                <span className="font-semibold text-ink">
                  {thisWeek} of {program.daysPerWeek}
                </span>{" "}
                sessions complete
              </>
            ) : (
              `${thisWeek} ${thisWeek === 1 ? "session" : "sessions"}`
            )}
          </p>
        </div>
        <div className="mt-4">
          <HexWeekRow days={weekDots(completions, now)} />
        </div>
        {weekWorkouts > 0 && (
          <p className="mt-2 text-sm text-muted">
            Plus {weekWorkouts} {weekWorkouts === 1 ? "workout" : "workouts"} on your own this week.
          </p>
        )}
        {pending > 0 && (
          <p className="mt-2 text-sm text-muted">
            {pending} {pending === 1 ? "session is" : "sessions are"} saved on this phone and will sync when you are back online. They already count this week.
          </p>
        )}
      </section>

      {quick.length > 0 && (
        <section aria-labelledby="quick-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="quick-h" className="font-sans text-lg font-semibold">
              {t("today.quickTitle")}
            </h2>
            <Link href="/app/workouts" className="btn btn-quiet -mr-4">
              See all
            </Link>
          </div>
          <ul className="mt-2 space-y-3">
            {quick.map((w) => (
              <li key={w.slug}>
                <WorkoutCard w={w} compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      <AppointmentRow />
      <FromReminder />
    </div>
  );
}

/** Opened from a reminder: turning them off is one tap here too (iPhone shows no notification actions). */
function FromReminder() {
  const from = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("from"),
    () => null,
  );
  const [off, setOff] = useState(false);
  if (from !== "reminder") return null;
  return (
    <p className="text-center">
      {off ? (
        <span role="status">Reminders are off. You can turn them on again in Settings.</span>
      ) : (
        <button
          type="button"
          className="btn btn-quiet"
          onClick={async () => {
            await disableReminders();
            setOff(true);
          }}
        >
          {t("remind.off")}
        </button>
      )}
    </p>
  );
}
