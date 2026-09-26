/**
 * Progress maths on the device's own records (so offline sessions count straight away).
 * Pure functions, tested in tests/progress.test.ts. Days are local calendar days; weeks
 * start on Monday.
 */
import type { LocalCompletion } from "@/lib/client/store";
import type { Feel, PatientProgram, PlanSession } from "@/lib/types";

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function inRange(c: LocalCompletion, from: Date, to: Date): boolean {
  const t = new Date(c.completedAt).getTime();
  return t >= from.getTime() && t < to.getTime();
}

export function completionsBetween(all: LocalCompletion[], from: Date, to: Date): LocalCompletion[] {
  return all.filter((c) => inRange(c, from, to));
}

/** Share of exercises done (not skipped) across completions, 0..1. */
export function doneShare(cs: LocalCompletion[]): number {
  const items = cs.flatMap((c) => c.items);
  if (!items.length) return cs.length ? 1 : 0;
  return items.filter((i) => i.done).length / items.length;
}

export interface Bar {
  key: string;
  label: string;
  longLabel: string;
  sessions: number;
  /** 0..1: how much of those sessions was done (mint intensity). */
  share: number;
  today: boolean;
  future: boolean;
}

export function weekBars(all: LocalCompletion[], now = new Date()): Bar[] {
  const start = startOfWeek(now);
  return DAY_NAMES.map((name, i) => {
    const from = addDays(start, i);
    const cs = completionsBetween(all, from, addDays(from, 1));
    const today = dayKey(from) === dayKey(now);
    return { key: dayKey(from), label: DAY_LETTERS[i], longLabel: name, sessions: cs.length, share: doneShare(cs), today, future: !today && from > now };
  });
}

/** The weeks (Mon-Sun) that touch the current month, one bar each. */
export function monthBars(all: LocalCompletion[], now = new Date()): Bar[] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const bars: Bar[] = [];
  let w = startOfWeek(first);
  let n = 1;
  while (w.getMonth() === now.getMonth() || w < first) {
    const cs = completionsBetween(all, w, addDays(w, 7));
    const current = dayKey(startOfWeek(now)) === dayKey(w);
    bars.push({ key: dayKey(w), label: `W${n}`, longLabel: `Week of ${MONTHS[w.getMonth()]} ${w.getDate()}`, sessions: cs.length, share: doneShare(cs), today: current, future: w > now });
    w = addDays(w, 7);
    n++;
    if (n > 6) break;
  }
  return bars;
}

export function monthRange(now = new Date()): [Date, Date] {
  return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
}

export function weekRange(now = new Date()): [Date, Date] {
  const s = startOfWeek(now);
  return [s, addDays(s, 7)];
}

/** Weeks (Mon-Sun) that touch the month, for the month target (days-per-week x weeks). */
export function weeksInMonth(now = new Date()): number {
  return monthBars([], now).length;
}

export function feelCounts(cs: LocalCompletion[]): Record<Feel, number> {
  const out: Record<Feel, number> = { 1: 0, 2: 0, 3: 0 };
  for (const c of cs) if (c.feel) out[c.feel]++;
  return out;
}

export function weekDots(all: LocalCompletion[], now = new Date()): { key: string; label: string; longLabel: string; done: boolean; today: boolean }[] {
  return weekBars(all, now).map((b) => ({ key: b.key, label: b.label, longLabel: b.longLabel, done: b.sessions > 0, today: b.today }));
}

/**
 * The session to do next: the one after the most recently completed session of this program,
 * in plan order, wrapping around. First session when nothing is done yet.
 */
export function nextSession(program: PatientProgram, all: LocalCompletion[]): PlanSession {
  const sessions = [...program.sessions].sort((a, b) => a.sort - b.sort);
  const mine = all.filter((c) => c.programCode === program.code).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const last = mine[mine.length - 1];
  const i = last ? sessions.findIndex((s) => s.id === last.programSessionId) : -1;
  return sessions[(i + 1) % sessions.length] ?? sessions[0];
}
