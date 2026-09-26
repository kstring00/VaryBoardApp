"use client";

import Link from "next/link";
import { ArrowIcon } from "@/components/app/icons";
import { useCompletions, useProgram } from "@/lib/client/store";
import { eric } from "@/content/site";
import { GENRE_NAMES } from "@/lib/genres";
import { byGenre, exerciseCount, prescription, sessionMinutes } from "@/lib/program";
import { nextSession } from "@/lib/progress";

export function PlanView() {
  const program = useProgram();
  const completions = useCompletions();

  if (program === undefined || completions === undefined) {
    return (
      <>
        <h1 className="mt-2 text-4xl">My plan</h1>
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-surface" aria-busy="true" />
      </>
    );
  }

  if (!program) {
    return (
      <>
        <h1 className="mt-2 text-4xl">My plan</h1>
        <p className="mt-3 text-lg">Your plan appears here once you enter the 6-character code from your therapist.</p>
        <Link href="/app/code" className="btn btn-primary mt-6 w-full">
          Enter your therapist&rsquo;s code <ArrowIcon />
        </Link>
        <p className="mt-4 text-center">
          <Link href="/app/starter" className="font-semibold text-teal underline">
            Try a starter plan
          </Link>
        </p>
        <p className="mt-10 text-center">
          <Link href="/app/find" className="text-teal underline">
            No code? Find a workout to start with
          </Link>
        </p>
      </>
    );
  }

  const next = nextSession(program, completions);
  const sessions = [...program.sessions].sort((a, b) => a.sort - b.sort);
  return (
    <>
      <p className="eyebrow mt-2">{program.isStarter ? "Starter plan" : "Your program"} · code {program.code}</p>
      <h1 className="mt-1 text-4xl">{program.name}</h1>
      <p className="mt-2 text-lg">
        {program.daysPerWeek} {program.daysPerWeek === 1 ? "day" : "days"} a week ·{" "}
        {program.isStarter ? `from ${eric.name}, ${eric.credentials}` : program.clinicName ? `from ${program.clinicName}` : "from your therapist"}
      </p>

      <ol className="mt-6 space-y-5">
        {sessions.map((s) => {
          const isNext = s.id === next.id;
          return (
            <li key={s.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl">{s.name}</h2>
                  <p className="mt-1 text-muted">
                    {sessionMinutes(s)} min • {exerciseCount(s)}
                  </p>
                </div>
                {isNext && <span className="chip shrink-0 font-semibold text-teal">Next up</span>}
              </div>
              {byGenre([...s.blocks].sort((a, b) => a.sort - b.sort)).map((g) => (
                <div key={g.genre} className="mt-4">
                  <p className="chip">{GENRE_NAMES[g.genre]}</p>
                  <ul className="mt-2 space-y-2">
                    {g.blocks.map((b) => (
                      <li key={b.id}>
                        <Link href={`/app/movement/${b.movement.slug}`} className="flex min-h-12 flex-col justify-center rounded-lg px-1 text-ink no-underline hover:bg-mint-wash">
                          <span className="font-medium underline decoration-line underline-offset-4">{b.movement.name}</span>
                          <span className="text-sm text-muted">
                            {prescription(b)}
                            {b.bandColor ? ` · ${b.bandColor} band` : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {isNext ? (
                <Link href={`/app/session?s=${s.id}`} className="btn btn-primary mt-5 w-full">
                  Start session <ArrowIcon />
                </Link>
              ) : (
                <Link href={`/app/session?s=${s.id}`} className="btn btn-quiet mt-3 w-full">
                  Do this session instead
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-center">
        <Link href="/app/library" className="text-teal underline">
          Browse the movement library
        </Link>
      </p>
    </>
  );
}
