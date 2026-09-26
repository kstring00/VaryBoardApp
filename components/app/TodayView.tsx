"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppointmentRow } from "@/components/AppointmentRow";
import { HexWeekRow } from "@/components/HexCharts";
import { SessionCard } from "@/components/SessionCard";
import { ArrowIcon } from "@/components/app/icons";
import { setProgram, useActive, useCompletions, useOutboxCount, useProfile, useProgram } from "@/lib/client/store";
import { flushOutbox } from "@/lib/client/submit";
import { completionsBetween, nextSession, weekDots, weekRange } from "@/lib/progress";
import type { PatientProgram } from "@/lib/types";

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

export function TodayView({ photo }: { photo: string | null }) {
  const program = useProgram();
  const completions = useCompletions();
  const active = useActive();
  const pending = useOutboxCount();
  const [ended, setEnded] = useState(false);
  const [now] = useState(() => new Date());

  // Keep the stored plan fresh (quietly; offline keeps the stored copy) and sync saved sessions.
  useEffect(() => {
    void flushOutbox();
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

  if (program === undefined || completions === undefined) {
    return <div className="mt-6 h-80 animate-pulse rounded-2xl bg-surface" aria-busy="true" aria-label="Loading your plan" />;
  }

  const [from, to] = weekRange(now);
  const thisWeek = completionsBetween(completions, from, to).length;

  return (
    <div className="mt-6 space-y-5">
      {program ? (
        (() => {
          const resuming = active && active.programCode === program.code && active.phase !== "done" ? active : null;
          const session = (resuming && program.sessions.find((s) => s.id === resuming.programSessionId)) || nextSession(program, completions);
          return <SessionCard program={program} session={session} photo={photo} resume={resuming ? { index: resuming.index, total: resuming.queue.length } : null} />;
        })()
      ) : (
        <section aria-labelledby="no-plan-h" className="rounded-2xl border border-line bg-mint-wash p-5 shadow-soft">
          <p className="eyebrow">Your next session</p>
          <h2 id="no-plan-h" className="mt-1 text-3xl">
            Start with your therapist&rsquo;s code
          </h2>
          <p className="mt-2">Your physical therapist gives you a 6-character code. Enter it once and your sessions appear here.</p>
          <Link href="/app/code" className="btn btn-primary mt-6 w-full">
            Enter your therapist&rsquo;s code <ArrowIcon />
          </Link>
          <p className="mt-4 text-center">
            <Link href="/app/starter" className="font-semibold text-teal underline">
              No code? Try a starter plan
            </Link>
          </p>
        </section>
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
            {program ? (
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
        {pending > 0 && (
          <p className="mt-2 text-sm text-muted">
            {pending} {pending === 1 ? "session is" : "sessions are"} saved on this phone and will sync when you are back online. They already count this week.
          </p>
        )}
      </section>

      <AppointmentRow />
    </div>
  );
}
