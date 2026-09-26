"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddToHomeGuide } from "@/components/app/AddToHomeGuide";
import { getCompletions, setA2hsShown, useHabit, useProgram } from "@/lib/client/store";
import { anchorPhrase, disableReminders, downloadIcs, enableReminders, formatTime, needsHomeScreen, reminderStatus } from "@/lib/client/reminders";
import { t } from "@/lib/copy";
import { nextSession } from "@/lib/progress";

/** Reminders on / off in one tap, the Add to Home Screen guide on iPhone, and the calendar fallback. */
export function ReminderSettings() {
  const habit = useHabit();
  const program = useProgram();
  const [status, setStatus] = useState<"on" | "off" | "unsupported" | null>(null);
  const [guide, setGuide] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void reminderStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);

  const sessionName = program ? nextSession(program, getCompletions()).name : null;
  return (
    <section id="reminders" aria-labelledby="rem-h" className="card scroll-mt-4 p-5">
      <h2 id="rem-h" className="text-2xl">
        Reminders
      </h2>
      {!habit ? (
        <p className="mt-2">
          Pick when you will move first.{" "}
          <Link href="/app/start" className="text-teal underline">
            Set your time
          </Link>
        </p>
      ) : (
        <>
          <p className="mt-2">
            {t("commit.statement", { days: habit.days.length, anchor: anchorPhrase(habit) })} {formatTime(habit.time)}.{" "}
            <Link href="/app/start" className="text-teal underline">
              Change
            </Link>
          </p>
          {message && (
            <p role="status" className="mt-3 rounded-xl bg-warn-bg p-3 text-warn-ink">
              {message}
            </p>
          )}
          {guide ? (
            <div className="mt-4">
              <AddToHomeGuide
                onDone={() => {
                  setA2hsShown();
                  setGuide(false);
                }}
              />
            </div>
          ) : status === "on" ? (
            <button
              type="button"
              className="btn btn-secondary mt-4 w-full"
              onClick={async () => {
                await disableReminders();
                setStatus("off");
                setMessage("Reminders are off.");
              }}
            >
              {t("remind.off")}
            </button>
          ) : needsHomeScreen() ? (
            <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setGuide(true)}>
              {t("remind.push")}
            </button>
          ) : status === "off" ? (
            <button
              type="button"
              className="btn btn-secondary mt-4 w-full"
              onClick={async () => {
                const r = await enableReminders();
                setStatus(r === "on" ? "on" : "off");
                setMessage(r === "on" ? `Reminders are on: ${formatTime(habit.time)} on your days.` : r === "denied" ? t("remind.denied") : t("remind.unsupported"));
              }}
            >
              {t("remind.push")}
            </button>
          ) : status === "unsupported" ? (
            <p className="mt-3 text-muted">{t("remind.unsupported")}</p>
          ) : null}
          <button type="button" className="btn btn-quiet mt-1 w-full" onClick={() => downloadIcs(habit, sessionName)}>
            {t("remind.calendar")}
          </button>
        </>
      )}
    </section>
  );
}
