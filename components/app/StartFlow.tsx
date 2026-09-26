"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AddToHomeGuide } from "@/components/app/AddToHomeGuide";
import { getA2hsShown, getCompletions, getHabit, setA2hsShown, setHabit, useProgram, type HabitAnchor } from "@/lib/client/store";
import { HABIT_KEYS, HABIT_TIMES, anchorPhrase, defaultDays, downloadIcs, enableReminders, formatTime, needsHomeScreen, pushSupported, syncReminderText } from "@/lib/client/reminders";
import { t } from "@/lib/copy";
import { nextSession } from "@/lib/progress";

const ANCHORS: HabitAnchor[] = ["coffee", "walk", "tv", "bed", "custom"];
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function StartFlow() {
  const router = useRouter();
  const program = useProgram();
  const [step, setStep] = useState<"habit" | "commit" | "remind" | "a2hs">("habit");
  const [anchor, setAnchor] = useState<HabitAnchor | null>(null);
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<number[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const shell = (children: React.ReactNode) => <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-4 pt-[max(env(safe-area-inset-top),24px)]">{children}</main>;
  if (program === undefined) return <main className="min-h-dvh" aria-busy="true" />;
  if (!program) {
    return shell(
      <>
        <h1 className="text-4xl">Enter your code first</h1>
        <p className="mt-3 text-lg">Your plan comes from your therapist&rsquo;s code.</p>
        <Link href="/app/code" className="btn btn-primary mt-6 w-full">
          Enter your therapist&rsquo;s code
        </Link>
      </>,
    );
  }
  const chosenDays = days ?? getHabit()?.days ?? defaultDays(program.daysPerWeek);
  const sessionName = nextSession(program, getCompletions()).name;
  const done = () => router.push("/app");


  if (step === "habit") {
    return shell(
      <>
        <p className="eyebrow">Step 1 of 2</p>
        <h1 ref={heading} tabIndex={-1} className="mt-1 text-4xl outline-none">
          {t("habit.title")}
        </h1>
        <p className="mt-2 text-lg">{t("habit.hint")}</p>
        <fieldset className="mt-6 flex-1">
          <legend className="sr-only">{t("habit.title")}</legend>
          <div className="grid gap-3">
            {ANCHORS.map((a) => (
              <label key={a} className={`flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal ${anchor === a ? "border-teal bg-mint-wash" : "border-line bg-surface"}`}>
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="anchor"
                    value={a}
                    checked={anchor === a}
                    onChange={() => {
                      setAnchor(a);
                      setTime(HABIT_TIMES[a]);
                    }}
                    className="h-5 w-5 accent-[var(--color-teal)]"
                  />
                  <span className="text-lg font-semibold">{t(HABIT_KEYS[a])}</span>
                </span>
                {a !== "custom" && <span className="text-muted">{formatTime(HABIT_TIMES[a])}</span>}
              </label>
            ))}
          </div>
          {anchor && (
            <label className="mt-4 block">
              <span className="label">{anchor === "custom" ? "Your time" : "Adjust the time if you like"}</span>
              <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value || time)} />
            </label>
          )}
        </fieldset>
        <div className="sticky bottom-0 -mx-4 mt-6 bg-plaster/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
          <button type="button" className="btn btn-primary w-full" disabled={!anchor} onClick={() => setStep("commit")}>
            {t("habit.next")}
          </button>
        </div>
      </>,
    );
  }

  if (step === "commit" && anchor) {
    const statement = t("commit.statement", { days: program.daysPerWeek, anchor: anchorPhrase({ anchor, time }) });
    return shell(
      <>
        <p className="eyebrow">Step 2 of 2</p>
        <h1 ref={heading} tabIndex={-1} className="mt-1 text-4xl outline-none">
          {t("commit.title")}
        </h1>
        <p className="mt-6 font-display text-3xl leading-snug text-ink">{statement}</p>
        <p className="mt-2 text-muted">
          {program.name} · {formatTime(time)}
        </p>
        <fieldset className="mt-8 flex-1">
          <legend className="font-semibold">{t("commit.days")}</legend>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {DAY_LETTERS.map((l, i) => {
              const d = i + 1;
              const on = chosenDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[i]}
                  onClick={() => setDays(on ? chosenDays.filter((x) => x !== d) : [...chosenDays, d].sort())}
                  className={`h-12 rounded-xl border-2 font-semibold ${on ? "border-teal bg-mint text-ink" : "border-line bg-surface text-muted"}`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </fieldset>
        <button
          type="button"
          className="btn btn-primary mt-6 w-full"
          disabled={chosenDays.length === 0}
          onClick={() => {
            setHabit({ programCode: program.code, anchor, time, days: chosenDays, committedAt: new Date().toISOString() });
            syncReminderText(sessionName);
            setStep(needsHomeScreen() && !getA2hsShown() ? "a2hs" : "remind");
          }}
        >
          {t("commit.cta")}
        </button>
        <button type="button" className="btn btn-quiet mt-1 w-full" onClick={() => setStep("habit")}>
          Back
        </button>
      </>,
    );
  }

  if (step === "a2hs") {
    return shell(
      <>
        <h1 ref={heading} tabIndex={-1} className="sr-only outline-none">
          {t("a2hs.title")}
        </h1>
        <AddToHomeGuide
          onDone={() => {
            setA2hsShown();
            done();
          }}
        />
        <button type="button" className="btn btn-quiet mt-3 w-full" onClick={() => downloadIcs({ time, days: chosenDays }, sessionName)}>
          {t("remind.calendar")}
        </button>
      </>,
    );
  }

  // Reminder offer.
  const canPush = pushSupported() && !needsHomeScreen();
  return shell(
    <>
      <h1 ref={heading} tabIndex={-1} className="text-4xl outline-none">
        {t("remind.title")}
      </h1>
      <p className="mt-3 text-lg">{t("remind.body", { time: formatTime(time) })}</p>
      <p className="mt-4 rounded-xl bg-mint-wash p-4 font-medium">&ldquo;{t("remind.notification", { session: sessionName })}&rdquo;</p>
      {message && (
        <p role="status" className="mt-4 rounded-xl bg-warn-bg p-3 text-warn-ink">
          {message}
        </p>
      )}
      <div className="flex-1" />
      {canPush ? (
        <button
          type="button"
          className="btn btn-primary mt-6 w-full"
          onClick={async () => {
            const r = await enableReminders();
            if (r === "on") done();
            else setMessage(r === "denied" ? t("remind.denied") : t("remind.unsupported"));
          }}
        >
          {t("remind.push")}
        </button>
      ) : (
        <p className="mt-6 text-muted">{t("remind.unsupported")}</p>
      )}
      <button type="button" className={`btn ${canPush ? "btn-secondary" : "btn-primary"} mt-3 w-full`} onClick={() => downloadIcs({ time, days: chosenDays }, sessionName)}>
        {t("remind.calendar")}
      </button>
      <button type="button" className="btn btn-quiet mt-1 w-full" onClick={done}>
        {t("remind.notNow")}
      </button>
    </>,
  );
}
