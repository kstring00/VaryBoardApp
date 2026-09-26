"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSteps, type Step } from "@/lib/timer";

type Dose = { sets: number | null; reps: number | null; holdSeconds: number | null };

function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    // Speech mixes with (ducks) the user's own music; it never pauses it the way video would.
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* no voice available */
  }
}

/**
 * Big, hands-free timer that follows the prescription. Start / Pause; progress is reported after
 * every step so a screen lock or app switch never loses a rep.
 */
export function Timer({ dose, initialStep = 0, onStep, spoken, cue }: { dose: Dose; initialStep?: number; onStep?: (i: number) => void; spoken: boolean; cue: string }) {
  const steps = useMemo(() => buildSteps({ sets: dose.sets, reps: dose.reps, holdSeconds: dose.holdSeconds }), [dose.sets, dose.reps, dose.holdSeconds]);
  const firstSteps = useRef(steps);
  const [index, setIndex] = useState(Math.min(initialStep, steps.length));
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(steps[Math.min(initialStep, steps.length - 1)]?.seconds ?? 0);
  const endAt = useRef<number | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const done = index >= steps.length;
  const step: Step | undefined = steps[index];

  // Reset when the dose changes (Make it easier / seated swap), not on mount (resume keeps its place).
  useEffect(() => {
    if (steps === firstSteps.current) return;
    firstSteps.current = steps;
    setIndex(0);
    setRunning(false);
    setLeft(steps[0]?.seconds ?? 0);
    endAt.current = null;
  }, [steps]);

  const lockScreenAwake = useCallback(async (on: boolean) => {
    try {
      if (on && "wakeLock" in navigator) wake.current = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
      else if (!on) {
        await wake.current?.release();
        wake.current = null;
      }
    } catch {
      /* not supported */
    }
  }, []);

  useEffect(() => {
    if (!running || !step) return;
    endAt.current ??= Date.now() + left * 1000;
    const t = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil(((endAt.current ?? 0) - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining > 0) return;
      const next = index + 1;
      endAt.current = null;
      setIndex(next);
      onStep?.(next);
      try {
        navigator.vibrate?.(next >= steps.length ? [120, 80, 120] : 60);
      } catch {
        /* ignore */
      }
      const ns = steps[next];
      if (!ns) {
        setRunning(false);
        void lockScreenAwake(false);
        speak("All sets done", spoken);
        return;
      }
      if (ns.kind === "rest") speak(`Rest. Set ${ns.set + 1} is next`, spoken);
      else if (ns.set !== step.set) speak(`Set ${ns.set}`, spoken);
      setLeft(ns.seconds);
    }, 250);
    return () => window.clearInterval(t);
  }, [running, index, step, left, steps, onStep, spoken, lockScreenAwake]);

  useEffect(() => () => void lockScreenAwake(false), [lockScreenAwake]);

  const toggle = () => {
    if (done) return;
    if (running) {
      setRunning(false);
      endAt.current = null;
      void lockScreenAwake(false);
    } else {
      if (index === 0 && left === steps[0]?.seconds) speak(cue, spoken);
      setRunning(true);
      void lockScreenAwake(true);
    }
  };

  const sets = Math.max(1, dose.sets ?? 1);
  const reps = dose.reps ?? null;
  const label = !step ? "Done" : step.kind === "hold" ? "Hold" : step.kind === "relax" ? "Relax" : step.kind === "rest" ? "Rest" : "Rep";

  return (
    <section aria-label="Exercise timer" className="card p-5 text-center">
      <p className="text-lg font-semibold text-muted" aria-live="polite">
        {done ? "All sets done" : `Set ${step!.set} of ${sets}${reps ? ` · Rep ${step!.rep} of ${reps}` : ""}`}
      </p>
      <p className="mt-1 font-display text-[4.5rem] leading-none text-ink tabular-nums" aria-live="off">
        {done ? "✓" : step!.kind === "rep" ? step!.rep : left}
      </p>
      <p className="mt-1 text-xl font-semibold text-teal" aria-live="assertive">
        {done ? "Tap Done when you are ready" : step!.kind === "rep" ? `Rep · next in ${left}s` : `${label} · seconds`}
      </p>
      {!done && (
        <button type="button" onClick={toggle} className="btn btn-secondary mt-5 w-full" aria-pressed={running}>
          {running ? "Pause" : index === 0 && left === steps[0]?.seconds ? "Start timer" : "Resume timer"}
        </button>
      )}
    </section>
  );
}
