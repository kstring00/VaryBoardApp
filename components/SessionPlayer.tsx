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
  getActive,
  getCompletions,
  prefersReducedMotion,
  setActive,
  useActive,
  useCompletions,
  useProgram,
  useSettings,
  uuid,
  type ActiveSession,
  type LocalCompletion,
  type LocalItem,
} from "@/lib/client/store";
import { queueCompletion } from "@/lib/client/submit";
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

/** Saves the session on the device (always) and queues it for the server. */
function saveCompletion(a: ActiveSession, feel: Feel | null): LocalCompletion {
  const items = a.queue.map((id) => a.items[id]).filter((i): i is LocalItem => !!i);
  const c: LocalCompletion = { id: uuid(), programCode: a.programCode, programSessionId: a.programSessionId, sessionName: a.sessionName, startedAt: a.startedAt, completedAt: new Date().toISOString(), feel, items };
  addCompletion(c);
  queueCompletion(c);
  return c;
}

export function SessionPlayer({ photo }: { photo: string | null }) {
  const program = useProgram();
  const active = useActive();
  const params = useSearchParams();
  const requested = params.get("s");
  const [dismissed, setDismissed] = useState(false);

  // Start a session once the stored plan is available, unless one is already in progress.
  useEffect(() => {
    if (!program) return;
    const current = getActive();
    if (current && current.programCode === program.code && current.phase !== "done") return; // resume (or ask, below)
    const target = program.sessions.find((s) => s.id === requested) ?? nextSession(program, getCompletions());
    setActive(newActive(program, target));
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
              saveCompletion(active, null); // keep what was done
              setActive(newActive(program, target));
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
  if (!session) return <MissingSession />;
  return <Player program={program} session={session} active={active} photo={photo} />;
}

function Player({ program, session, active, photo }: { program: PatientProgram; session: PlanSession; active: ActiveSession; photo: string | null }) {
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

  const update = (patch: Partial<ActiveSession>) => setActive({ ...active, ...patch });
  const itemFor = (b: PlanBlock): LocalItem =>
    active.items[b.id] ?? {
      id: uuid(),
      blockId: b.id,
      movementId: b.movement.id,
      movementName: b.movement.name,
      done: false,
      skipped: false,
      skipReason: null,
      eased: false,
      seated: settings.preferSeated && !!b.seatedAlternative,
    };
  const setItem = (b: PlanBlock, patch: Partial<LocalItem>, rest: Partial<ActiveSession> = {}) => {
    const next = { ...itemFor(b), ...patch };
    const movement = next.seated && b.seatedAlternative ? b.seatedAlternative : b.movement;
    next.movementId = movement.id;
    next.movementName = movement.name;
    setActive({ ...active, items: { ...active.items, [b.id]: next }, ...rest });
  };
  const advance = (items: Record<string, LocalItem>) => {
    const last = active.index + 1 >= total;
    setActive({ ...active, items, index: last ? active.index : active.index + 1, phase: last ? "feel" : "setup", timer: undefined });
    setTab("setup");
  };
  const finishExercise = (b: PlanBlock, patch: Partial<LocalItem>) => advance({ ...active.items, [b.id]: { ...itemFor(b), ...patch } });
  const doLater = () => {
    const queue = [...active.queue];
    const [id] = queue.splice(active.index, 1);
    queue.push(id);
    setActive({ ...active, queue, phase: "setup", timer: undefined });
    setTab("setup");
  };

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
    const mv = it.seated && block.seatedAlternative ? block.seatedAlternative : block.movement;
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
                  <p className="text-lg">Follow your therapist&rsquo;s setup — anchor position and resistance saved in your plan.</p>
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
                        <span className="font-semibold">Band:</span> {block.bandColor ?? "the band your therapist chose"}
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
              instructions: <Instructions block={block} eased={it.eased} seated={it.seated} />,
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
    const mv = it.seated && block.seatedAlternative ? block.seatedAlternative : block.movement;
    const dose = it.eased ? easierDose(block) : { sets: block.sets, reps: block.reps, holdSeconds: block.holdSeconds };
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
          {it.eased && <span className="chip ml-2 align-middle">Easier today</span>}
        </p>
        <div className="mt-4">
          <Timer
            key={`${block.id}-${it.eased}-${it.seated}`}
            dose={dose}
            initialStep={step}
            spoken={settings.spokenCues}
            cue={spokenCue(mv.name, dose)}
            onStep={(i) => {
              const a = getActive();
              if (a) setActive({ ...a, timer: { blockId: block.id, step: i } });
            }}
          />
        </div>
        <div className="mt-4 grid gap-3">
          <button type="button" className="btn btn-secondary w-full" aria-pressed={it.eased} onClick={() => setItem(block, { eased: !it.eased }, { timer: undefined })}>
            {it.eased ? "Back to my plan's amount" : "Make it easier"}
          </button>
          {block.seatedAlternative && (
            <button type="button" className="btn btn-secondary w-full" aria-pressed={it.seated} onClick={() => setItem(block, { seated: !it.seated }, { timer: undefined })}>
              {it.seated ? "Use the standing version" : "Use the seated version"}
            </button>
          )}
        </div>
        <details className="card mt-4 p-4">
          <summary className="min-h-12 cursor-pointer py-2 text-lg font-semibold">Instructions</summary>
          <Instructions block={block} eased={it.eased} seated={it.seated} />
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
      const c = saveCompletion(active, feel);
      setFreshDay(dayKey(new Date(c.completedAt)));
      setActive({ ...active, phase: "done", completionId: c.id, timer: undefined });
    };
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-[max(env(safe-area-inset-top),8px)]">
        {header}
        <p className="eyebrow mt-3">{session.name}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-4xl outline-none">
          How did movement feel?
        </h1>
        <p className="mt-2 text-muted">Compared with last time. Your answer goes to your therapist with the session.</p>
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
                      onClick={() => setActive({ ...active, items: { ...active.items, [i.blockId]: { ...i, skipReason: i.skipReason === r ? null : r } } })}
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
        Session saved.
      </h1>
      <p className="mt-2 text-lg">
        {done} of {total} exercises done. {count} of {program.daysPerWeek} sessions this week.
      </p>
      <div className="mx-auto mt-6 max-w-sm">
        <HexWeekRow days={weekDots(completions)} fresh={freshDay ?? dayKey(new Date())} />
      </div>
      <button
        type="button"
        className="btn btn-primary mt-8 w-full"
        onClick={() => {
          setActive(null);
          router.push("/app");
        }}
      >
        Back to Today
      </button>
    </main>
  );
}

/** The plan changed under a saved session (the therapist edited it): start fresh. */
function MissingSession() {
  useEffect(() => setActive(null), []);
  return <main className="min-h-dvh" aria-busy="true" />;
}

function Instructions({ block, eased, seated }: { block: PlanBlock; eased: boolean; seated: boolean }) {
  const mv = seated && block.seatedAlternative ? block.seatedAlternative : block.movement;
  const dose = eased ? easierDose(block) : block;
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
