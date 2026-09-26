"use client";

import { useState } from "react";
import { FEEL_LABELS } from "@/components/FeelPicker";
import { HexBarChart } from "@/components/HexCharts";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { ArrowIcon } from "@/components/app/icons";
import { useCompletions, useProgram } from "@/lib/client/store";
import { completionsBetween, feelCounts, monthBars, monthRange, weekBars, weekRange, weeksInMonth } from "@/lib/progress";
import type { Feel } from "@/lib/types";

export function ProgressView() {
  const completions = useCompletions();
  const program = useProgram();
  const [range, setRange] = useState<"week" | "month">("week");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => new Date());

  if (completions === undefined || program === undefined) return <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface" aria-busy="true" />;

  const perWeek = program?.daysPerWeek ?? 3;
  const [from, to] = range === "week" ? weekRange(now) : monthRange(now);
  const inRange = completionsBetween(completions, from, to);
  const target = range === "week" ? perWeek : perWeek * weeksInMonth(now);
  const bars = range === "week" ? weekBars(completions, now) : monthBars(completions, now);
  const feel = feelCounts(inRange);
  const feelTotal = feel[1] + feel[2] + feel[3];

  return (
    <div className="mt-5 space-y-5">
      <SegmentedTabs
        label="Time range"
        value={range}
        onChange={setRange}
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />

      <section className="card p-5" aria-labelledby="sessions-h">
        <p className="font-display text-5xl text-ink">
          {inRange.length} <span className="text-muted">/ {target}</span>
        </p>
        <h2 id="sessions-h" className="mt-1 font-sans text-lg font-semibold">
          Sessions completed this {range}
        </h2>
        <div className="mt-5">
          <HexBarChart
            bars={bars}
            max={range === "week" ? 2 : Math.max(2, perWeek)}
            summary={bars.map((b) => `${b.longLabel}: ${b.sessions} ${b.sessions === 1 ? "session" : "sessions"}`).join(". ")}
          />
        </div>
        <p className="mt-2 text-sm text-muted">Each hex is a session. Lighter mint means some exercises were skipped.</p>
      </section>

      <section className="card p-5" aria-labelledby="feel-h">
        <h2 id="feel-h" className="font-sans text-lg font-semibold">
          How did movement feel?
        </h2>
        {feelTotal === 0 ? (
          <p className="mt-2 text-muted">After each session you can say whether movement felt easier, the same or harder.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-3 text-center">
            {([1, 2, 3] as Feel[]).map((f) => (
              <li key={f} className="rounded-xl bg-mint-wash p-3">
                <span className="block font-display text-3xl">{feel[f]}</span>
                <span className="text-sm font-semibold">{FEEL_LABELS[f]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="visit-h">
        <h2 id="visit-h" className="text-2xl">
          For your next visit
        </h2>
        <p className="mt-2">Review your sessions and notes with your therapist.</p>
        <button
          type="button"
          className="btn btn-secondary mt-4 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { exportProgressSummary } = await import("@/lib/client/export-summary");
              await exportProgressSummary();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Making your summary…" : "Export progress summary"} <ArrowIcon />
        </button>
        <p className="mt-2 text-sm text-muted">Made on this phone. It includes your name and notes only if you typed them.</p>
      </section>
    </div>
  );
}
