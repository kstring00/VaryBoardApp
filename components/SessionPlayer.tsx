"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoardHero } from "@/components/BoardHero";
import { FeelPicker } from "@/components/FeelPicker";
import { HexWeekRow } from "@/components/HexCharts";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { Timer } from "@/components/Timer";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ArrowIcon, CheckIcon } from "@/components/app/icons";
import { describePattern } from "@/lib/board/geometry";
import {
  addCompletion,
  getCompletions,
  PLAN_SLOT,
  prefersReducedMotion,
  useActive,
  useActiveWorkout,
  useCompletions,
  useProgram,
  useSettings,
  uuid,
  WORKOUT_SLOT,
  type ActiveSession,
  type LocalCompletion,
  type LocalItem,
  type SessionSlot,
} from "@/lib/client/store";
import { flushEvents, logEvent } from "@/lib/client/events";
import { queueCompletion } from "@/lib/client/submit";
import { t } from "@/lib/copy";
import { GENRE_NAMES } from "@/lib/genres";
import { easierDose, prescription, spokenCue } from "@/lib/program";
import { completionsBetween, dayKey, nextSession, weekDots, weekRange } from "@/lib/progress";
import type { Feel, PatientProgram, PlanBlock, PlanSession } from "@/lib/types";

const SKIP_REASONS = ["No time today", "Didn't feel right", "Equipment", "Other"];

function newActive(program: PatientProgram, session: PlanSession): ActiveSession {
  return {
    id: uuid(),
    programCode: program.code,
    programSessionId: session.id,
    sessionName: session.name,
    startedAt: new Date().toISOString(),
    queue: [...session.blocks].sort((a, b) => a.sort - b.sort).map((b) => b.id),
    index: 0,
    phase: "setup",
    items: {},
  };
}

/**
 * Saves the session on the device (always). Plan sessions are queued for the server; a
 * self-guided workout stays on the device (there is no clinic to send it to).
 */
function saveCompletion(a: ActiveSession, feel: Feel | null, workout: boolean): LocalCompletion {
  const items = a.queue.map((id) => a.items[id]).filter((i): i is LocalItem => !!i);
  const c: LocalCompletion = { id: uuid(), programCode: a.programCode, programSessionId: a.programSessionId, sessionName: a.sessionName, startedAt: a.startedAt, completedAt: new Date().toISOString(), feel, items, ...(workout ? { kind: "workout" as const } : {}) };
  addCompletion(c);
  if (!workout) queueCompletion(c);
  return c;
}

/**
 * The player. With `workout`, it runs a self-guided workout in its own slot (a plan session in
 * progress is left untouched) and nothing is sent to a clinic.
 */
export function SessionPlayer({ photo, workout }: { photo: string | null; workout?: PatientProgram }) {
  const planProgram = useProgram();
  const planActive = useActive();
  const workoutActive = useActiveWorkout();
  const isWorkout = !!workout;
  const program = isWorkout ? workout : planProgram;
  const active = isWorkout ? workoutActive : planActive;
  const slot = isWorkout ? WORKOUT_SLOT : PLAN_SLOT;
  const params = useSearchParams();
  const requested = params.get("s");
  const [dismissed, setDismissed] = useState(false);

  // Start a session once the stored plan is available, unless one is already in progress.
  useEffect(() => {
    if (!program) return;
    const current = slot.get();
    if (current && current.programCode === program.code && current.phase !== "done") return; // resume (or ask, below)
    const target = program.sessions.find((s) => s.id === requested) ?? nextSession(program, getCompletions());
    slot.set(newActive(program, target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.code, requested]);

  const conflict = !dismissed && !!program && !!active && active.programCode === program.code && active.phase !== "done" && !!requested && requested !== active.programSessionId;

  if (program === undefined || active === undefined) return <main className="min-h-dvh" aria-busy="true" />;
  if (!program) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl">No plan on this phone yet</h1>
        <p className="mt-3">Enter the code from your therapist first, then your session appears here.</p>
        <Link href="/app/code" className="btn btn-primary mt-6 w-full">
          Enter your therapist&rsquo;s code <ArrowIcon />
        </Link>
      </main>
    );
  }
  if (conflict && active) {
    const target = program.sessions.find((s) => s.id === requested);
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl">You have a session in progress</h1>
        <p className="mt-3">
          {active.sessionName}: exercise {active.index + 1} of {active.queue.length}. Everything you have done is saved.
        </p>
        <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => setDismissed(true)}>
          Resume {active.sessionName}
        </button>
        {target && (
          <button
            type="button"
            className="btn btn-quiet mt-2 w-full"
            onClick={() => {
              saveCompletion(active, null, isWorkout); // keep what was done
              slot.set(newActive(program, target));
              setDismissed(true);
            }}
          >
            Save it as done so far and start {target.name}
          </button>
        )}
      </main>
    );
  }
  if (!active || active.programCode !== program.code) return <main className="min-h-dvh" aria-busy="true" />;
  const session = program.sessions.find((s) => s.id === active.programSessionId);
  if (!session) return <MissingSession slot={slot} />;
  return <Player program={program} session={session} active={active} photo={photo} slot={slot} isWorkout={isWorkout} />;
}

function Player({ program, session, active, photo, slot, isWorkout }: { program: PatientProgram; session: PlanSession; active: ActiveSession; photo: string | null; slot: SessionSlot; isWorkout: boolean }) {
  const router = useRouter();
  const settings = useSettings();
  const completions = useCompletions() ?? [];
  const [tab, setTab] = useState<"setup" | "demo" | "instructions">("setup");
  const [exitOpen, setExitOpen] = useState(false);
  const [freshDay, setFreshDay] = useState<string | undefined>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const blocks = useMemo(() => new Map(session.blocks.map((b) => [b.id, b])), [session]);

  const total = active.queue.length;
  const block = active.phase === "setup" || active.phase === "exercise" ? blocks.get(active.queue[active.index]) : undefined;

  // Move focus to the new heading on every step, for screen readers and keyboard users.
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [active.phase, active.index]);

  const update = (patch: Partial<ActiveSession>) => slot.set({ ...active, ...patch });
  const itemFor = (b: PlanBlock): LocalItem =>
    active.items[b.id] ?? {
      id: uuid(),
      blockId: b.id,
      movementId: b.movement.id,
      movementName: b.movement.name,
      done: false,
      skipped: false,
      skipReason: null,
      // "I use a chair or wheelchair" (Settings): the seated version is used automatically.
      variant: settings.chairUser && b.seatedAlternative ? "seated" : "plan",
      doseEased: false,
      easedLogged: false,
    };
  const setItem = (b: PlanBlock, patch: Partial<LocalItem>, rest: Partial<ActiveSession> = {}) => {
    const next = { ...itemFor(b), ...patch };
    const movement = movementFor(b, next);
    next.movementId = movement.id;
    next.movementName = movement.name;
    slot.set({ ...active, items: { ...active.items, [b.id]: next }, ...rest });
  };
  const advance = (items: Record<string, LocalItem>) => {
    const last = active.index + 1 >= total;
    slot.set({ ...active, items, index: last ? active.index : active.index + 1, phase: last ? "feel" : "setup", timer: undefined });
    setTab("setup");
  };
  /** Done or skipped: saved on the device this instant (event queue), then the next exercise. */
  /** Exercise events go to the clinic for plan sessions only. */
  const log = (b: PlanBlock, e: "done" | "skipped" | "made_easier") => {
    if (!isWorkout) void logEvent(active.programCode, b.id, e);
  };
  const finishExercise = (b: PlanBlock, patch: Pick<LocalItem, "done" | "skipped">) => {
    log(b, patch.done ? "done" : "skipped");
    advance({ ...active.items, [b.id]: { ...itemFor(b), ...patch } });
  };
  /**
   * "Make it easier", one tap: swap in the easier alternative, else the seated one, else one step
   * down in dose. Logs made_easier once per exercise so the therapist sees it.
   */
  const makeEasier = (b: PlanBlock) => {
    const it = itemFor(b);
    let patch: Partial<LocalItem>;
    if (b.easierAlternative && it.variant !== "easier") patch = { variant: "easier" };
    else if (b.seatedAlternative && it.variant === "plan") patch = { variant: "seated" };
    else if (!it.doseEased) patch = { doseEased: true };
    else return;
    if (!it.easedLogged) {
      log(b, "made_easier");
      patch.easedLogged = true;
    }
    setItem(b, patch, { timer: undefined });
  };
  const toggleSeated = (b: PlanBlock) => {
    const it = itemFor(b);
    if (it.variant === "seated") return setItem(b, { variant: "plan" }, { timer: undefined });
    const patch: Partial<LocalItem> = { variant: "seated" };
    if (!it.easedLogged && !settings.chairUser) {
      log(b, "made_easier");
      patch.easedLogged = true;
    }
    setItem(b, patch, { timer: undefined });
  };
  const doLater = () => {
    const queue = [...active.queue];
    const [id] = queue.splice(active.index, 1);
    queue.push(id);
    slot.set({ ...active, queue, phase: "setup", timer: undefined });
    setTab("setup");
  };

  // Send anything saved while offline as soon as the player opens.
  useEffect(() => {
    void flushEvents();
  }, []);

  const progressHexes = (
    <ol className="flex items-center gap-1.5" aria-label={`Exercise ${Math.min(active.index + 1, total)} of ${total}`}>
      {active.queue.map((id, i) => {
        const it = active.items[id];
        const state = it?.done ? "done" : it?.skipped ? "skipped" : i === active.index && active.phase !== "feel" && active.phase !== "done" ? "current" : "todo";
        return (
          <li key={id} aria-hidden="true">
            <svg viewBox="0 0 20 22" className="h-6 w-5">
              <polygon points="10,1 19,6 19,16 10,21 1,16 1,6" className={`${state === "done" ? "fill-mint stroke-teal hex-fill-in" : state === "current" ? "fill-surface stroke-teal" : state === "skipped" ? "fill-dormant stroke-dormant" : "fill-surface stroke-line"}`} strokeWidth={state === "current" ? 2.5 : 1.5} />
            </svg>
          </li>
        );
      })}
    </ol>
  );

  const header = (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={() => setExitOpen(true)} className="btn btn-quiet -ml-4 no-underline">
        Exit
      </button>
      {progressHexes}
    </div>
  );

  const exitDialog = exitOpen && (
    <div role="dialog" aria-modal="true" aria-labelledby="exit-h" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-soft">
        <h2 id="exit-h" className="text-2xl">
          Take a break?
        </h2>
        <p className="mt-2">Everything you have done is saved on this phone. You can pick up where you left off from Today.</p>
        <button type="button" className="btn btn-primary mt-5 w-full" onClick={() => setExitOpen(false)} autoFocus>
          Keep going
        </button>
        <button type="button" className="btn btn-secondary mt-3 w-full" onClick={() => router.push("/app")}>
          Leave and resume later
        </button>
        <button
          type="button"
          className="btn btn-quiet mt-1 w-full"
          onClick={() => {
            setExitOpen(false);
            update({ phase: "feel", timer: undefined });
          }}
        >
          Finish now with what I have done
        </button>
      </div>
    </div>
  );

  /* ---- Setup ------------------------------------------------------------------------------ */
  if (active.phase === "setup" && block) {
    const it = itemFor(block);
    const mv = movementFor(block, it);
    const anchor = block.anchor ?? mv.defaultAnchor;
    const saved = !!block.anchor;
    return (
      <main className="mx-auto max-w-xl px-4 pb-40 pt-[max(env(safe-area-inset-top),8px)]">
        {header}
        <p className="eyebrow mt-3">
          Exercise {active.index + 1} of {total}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-4xl outline-none">
          Set up your board.
        </h1>
        <BoardHero anchor={anchor} boardModels={mv.boardModels} photo={photo} callout={saved ? "Your saved anchor." : "Suggested anchor."} className="mt-4" />
        <div className="mt-5">
          <SegmentedTabs
            label="Exercise details"
            value={tab}
            onChange={setTab}
            options={[
              { value: "setup", label: "Setup" },
              { value: "demo", label: "Demo" },
              { value: "instructions", label: "Instructions" },
            ]}
            panels={{
              setup: (
                <div className="space-y-4">
                  <p className="text-lg">{isWorkout ? t("workout.setup") : "Follow your therapist\u2019s setup — anchor position and resistance saved in your plan."}</p>
                  <ul className="space-y-2">
                    <li>
                      <span className="font-semibold">Exercise:</span> {mv.name}
                    </li>
                    {anchor && (
                      <li>
                        <span className="font-semibold">Anchor:</span> {describePattern([anchor], anchor.section > 3 ? "xt" : settings.boardModel)[0]}
                      </li>
                    )}
                    {(mv.needsBand || block.bandColor) && (
                      <li>
                        <span className="font-semibold">Band:</span> {block.bandColor ?? (isWorkout ? t("workout.band") : "the band your therapist chose")}
                      </li>
                    )}
                    {mv.needsHandrail && <li>Handrails attached to the board.</li>}
                    {mv.needsChair && <li>A sturdy chair that will not slide.</li>}
                  </ul>
                  {mv.safetyNote && <p className="rounded-xl bg-warn-bg p-3 text-warn-ink">{mv.safetyNote}</p>}
                  <p className="chip bg-mint-wash text-base font-semibold text-teal">
                    <CheckIcon /> Setup ready
                  </p>
                </div>
              ),
              demo: <VideoPlayer name={mv.name} videoUrl={mv.videoUrl} posterUrl={mv.posterUrl} />,
              instructions: <Instructions block={block} item={it} />,
            }}
          />
        </div>
        <ActionBar>
          <button type="button" className="btn btn-primary w-full" onClick={() => setItem(block, {}, { phase: "exercise" })}>
            Continue to exercise <ArrowIcon />
          </button>
          <div className="mt-1 flex justify-between">
            <button type="button" className="btn btn-quiet" onClick={() => finishExercise(block, { skipped: true, done: false })}>
              Skip today
            </button>
            {active.index + 1 < total && (
              <button type="button" className="btn btn-quiet" onClick={doLater}>
                Do this later
              </button>
            )}
          </div>
        </ActionBar>
        {exitDialog}
      </main>
    );
  }

  /* ---- Exercise --------------------------------------------------------------------------- */
  if (active.phase === "exercise" && block) {
    const it = itemFor(block);
    const mv = movementFor(block, it);
    const dose = doseFor(block, it);
    const eased = it.variant === "easier" || it.doseEased || (it.variant === "seated" && !settings.chairUser);
    const canEase = (!!block.easierAlternative && it.variant !== "easier") || (!!block.seatedAlternative && it.variant === "plan") || !it.doseEased;
    const step = active.timer?.blockId === block.id ? active.timer.step : 0;
    return (
      <main className="mx-auto max-w-xl px-4 pb-40 pt-[max(env(safe-area-inset-top),8px)]">
        {header}
        <p className="eyebrow mt-3">
          Exercise {active.index + 1} of {total} · <span className="normal-case tracking-normal">{GENRE_NAMES[mv.genreSlug]}</span>
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-3xl outline-none">
          {mv.name}
        </h1>
        <p className="mt-2 text-xl font-semibold">
          {prescription(dose)}
          {eased && <span className="chip ml-2 align-middle">{t("session.easierOn")}</span>}
        </p>
        <div className="mt-4">
          <Timer
            key={`${block.id}-${it.variant}-${it.doseEased}`}
            dose={dose}
            initialStep={step}
            spoken={settings.spokenCues}
            cue={spokenCue(mv.name, dose)}
            onStep={(i) => {
              const a = slot.get();
              if (a) slot.set({ ...a, timer: { blockId: block.id, step: i } });
            }}
          />
        </div>
        <div className="mt-4 grid gap-3">
          {canEase && (
            <button type="button" className="btn btn-secondary w-full" onClick={() => makeEasier(block)}>
              {t("session.makeEasier")}
            </button>
          )}
          {block.seatedAlternative && !settings.chairUser && it.variant !== "easier" && (
            <button type="button" className="btn btn-secondary w-full" aria-pressed={it.variant === "seated"} onClick={() => toggleSeated(block)}>
              {it.variant === "seated" ? "Use the standing version" : "Use the seated version"}
            </button>
          )}
          {(it.variant === "easier" || it.doseEased) && (
            <button type="button" className="btn btn-quiet w-full" onClick={() => setItem(block, { variant: settings.chairUser && block.seatedAlternative ? "seated" : "plan", doseEased: false }, { timer: undefined })}>
              {isWorkout ? "Back to the workout" : "Back to my plan"}
            </button>
          )}
        </div>
        <details className="card mt-4 p-4">
          <summary className="min-h-12 cursor-pointer py-2 text-lg font-semibold">Instructions</summary>
          <Instructions block={block} item={it} />
        </details>
        <ActionBar>
          <button type="button" className="btn btn-primary w-full" onClick={() => finishExercise(block, { done: true, skipped: false })}>
            <CheckIcon /> {active.index + 1 < total ? "Done, next exercise" : "Done, finish session"}
          </button>
          <div className="mt-1 flex justify-between">
            <button type="button" className="btn btn-quiet" onClick={() => update({ phase: "setup", timer: undefined })}>
              Back to setup
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => finishExercise(block, { skipped: true, done: false })}>
              Skip today
            </button>
          </div>
        </ActionBar>
        {exitDialog}
      </main>
    );
  }

  /* ---- How did movement feel? ------------------------------------------------------------- */
  if (active.phase === "feel") {
    const skipped = active.queue.map((id) => active.items[id]).filter((i): i is LocalItem => !!i?.skipped);
    const save = (feel: Feel | null) => {
      const c = saveCompletion(active, feel, isWorkout);
      setFreshDay(dayKey(new Date(c.completedAt)));
      slot.set({ ...active, phase: "done", completionId: c.id, timer: undefined });
    };
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-[max(env(safe-area-inset-top),8px)]">
        {header}
        <p className="eyebrow mt-3">{session.name}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-4xl outline-none">
          How did movement feel?
        </h1>
        <p className="mt-2 text-muted">{isWorkout ? t("workout.feelNote") : "Compared with last time. Your answer goes to your therapist with the session."}</p>
        {skipped.length > 0 && (
          <section className="card mt-5 p-4" aria-labelledby="skip-h">
            <h2 id="skip-h" className="font-sans text-lg font-semibold">
              Skipped today (optional note)
            </h2>
            <p className="text-sm text-muted">Reasons stay on this phone and appear in your progress summary.</p>
            {skipped.map((i) => (
              <fieldset key={i.id} className="mt-3">
                <legend className="font-medium">{i.movementName}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SKIP_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={i.skipReason === r}
                      className={`chip min-h-12 border-2 px-4 ${i.skipReason === r ? "border-teal bg-mint-wash" : "border-line bg-surface"}`}
                      onClick={() => slot.set({ ...active, items: { ...active.items, [i.blockId]: { ...i, skipReason: i.skipReason === r ? null : r } } })}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>
        )}
        <div className="mt-6">
          <FeelPicker value={null} onChange={(f) => save(f)} />
        </div>
        <button type="button" className="btn btn-quiet mt-4 w-full" onClick={() => save(null)}>
          Save without answering
        </button>
      </main>
    );
  }

  /* ---- Done ------------------------------------------------------------------------------- */
  const [from, to] = weekRange();
  const count = completionsBetween(completions, from, to).length;
  const done = active.queue.filter((id) => active.items[id]?.done).length;
  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-12 text-center">
      <svg viewBox="0 0 120 130" className="mx-auto h-40 w-40" aria-hidden="true">
        <polygon points="60,5 115,35 115,95 60,125 5,95 5,35" className="fill-none stroke-mint" strokeWidth={3} />
        <polygon points="60,5 115,35 115,95 60,125 5,95 5,35" className="fill-mint hex-fill-in" />
        <path d="M38 66 l15 15 l30 -32" className="fill-none stroke-white" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-4xl outline-none">
        {isWorkout ? "Workout saved." : "Session saved."}
      </h1>
      <p className="mt-2 text-lg">
        {done} of {total} exercises done.{" "}
        {isWorkout ? `${count} ${count === 1 ? "session" : "sessions"} this week.` : `${count} of ${program.daysPerWeek} sessions this week.`}
      </p>
      <div className="mx-auto mt-6 max-w-sm">
        <HexWeekRow days={weekDots(completions)} fresh={freshDay ?? dayKey(new Date())} />
      </div>
      <button
        type="button"
        className="btn btn-primary mt-8 w-full"
        onClick={() => {
          slot.set(null);
          router.push("/app");
        }}
      >
        Back to Today
      </button>
      {isWorkout && (
        <Link
          href="/app/workouts"
          className="btn btn-quiet mt-2 w-full"
          onClick={() => slot.set(null)}
        >
          More workouts
        </Link>
      )}
    </main>
  );
}

/** The plan changed under a saved session (the therapist edited it): start fresh. */
function MissingSession({ slot }: { slot: SessionSlot }) {
  useEffect(() => slot.set(null), [slot]);
  return <main className="min-h-dvh" aria-busy="true" />;
}

function movementFor(b: PlanBlock, it: LocalItem) {
  if (it.variant === "easier" && b.easierAlternative) return b.easierAlternative;
  if (it.variant === "seated" && b.seatedAlternative) return b.seatedAlternative;
  return b.movement;
}

function doseFor(b: PlanBlock, it: LocalItem) {
  const base = { sets: b.sets, reps: b.reps, holdSeconds: b.holdSeconds };
  return it.doseEased ? easierDose(base) : base;
}

function Instructions({ block, item }: { block: PlanBlock; item: LocalItem }) {
  const mv = movementFor(block, item);
  const dose = doseFor(block, item);
  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold">{prescription(dose)}</p>
      {block.bandColor && <p>Band: {block.bandColor}</p>}
      {mv.cues.length > 0 && (
        <ol className="list-decimal space-y-2 pl-6">
          {mv.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      )}
      {mv.safetyNote && <p className="rounded-xl bg-warn-bg p-3 text-warn-ink">{mv.safetyNote}</p>}
    </div>
  );
}

/** Primary actions pinned to the bottom of the screen: the thumb zone. */
function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
      <div className="mx-auto max-w-xl">{children}</div>
    </div>
  );
}
