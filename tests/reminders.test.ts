/** Reminder scheduling: one push per device per day at the local time; off stops it. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isDue, localParts, runReminders, type ReminderSub } from "../lib/reminders";
import { noteProblem, NOTE_MAX } from "../lib/labels";
import { easierDose } from "../lib/program";

function fakeStore(subs: ReminderSub[]) {
  const sent: string[] = [];
  return {
    sent,
    deps: (now: Date) => ({
      now,
      load: async () => subs.filter((s) => s.active),
      send: async (s: ReminderSub) => {
        sent.push(s.endpoint);
        return 201;
      },
      markSent: async (endpoint: string, localDate: string) => {
        subs.find((s) => s.endpoint === endpoint)!.lastSentOn = localDate;
      },
      deactivate: async (endpoint: string) => {
        subs.find((s) => s.endpoint === endpoint)!.active = false;
      },
    }),
  };
}

const hhmm = (d: Date, tz: string) => {
  const p = localParts(d, tz);
  return `${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`;
};

describe("reminders", () => {
  it("a subscription 2 minutes ahead gets exactly one push; toggling off stops it", async () => {
    const tz = "America/Chicago";
    const t0 = new Date("2026-09-28T13:00:00Z"); // Monday 08:00 in Chicago
    const sub: ReminderSub = { endpoint: "https://push.test/1", p256dh: "p", auth: "a", reminderLocalTime: hhmm(new Date(t0.getTime() + 2 * 60e3), tz), timezone: tz, reminderDays: [1, 2, 3, 4, 5, 6, 7], active: true, lastSentOn: null };
    const store = fakeStore([sub]);
    await runReminders(store.deps(t0)); // before the time
    assert.equal(store.sent.length, 0);
    await runReminders(store.deps(new Date(t0.getTime() + 3 * 60e3))); // cron run after the time
    assert.equal(store.sent.length, 1);
    await runReminders(store.deps(new Date(t0.getTime() + 18 * 60e3))); // next cron run, same day
    await runReminders(store.deps(new Date(t0.getTime() + 33 * 60e3)));
    assert.equal(store.sent.length, 1, "one per day");
    await runReminders(store.deps(new Date(t0.getTime() + 864e5 + 3 * 60e3))); // next day
    assert.equal(store.sent.length, 2);
    sub.active = false; // Turn off reminders
    await runReminders(store.deps(new Date(t0.getTime() + 2 * 864e5 + 3 * 60e3)));
    assert.equal(store.sent.length, 2, "no push after turning off");
  });

  it("only on committed days, within the grace window, in the device's time zone", () => {
    const sub: ReminderSub = { endpoint: "e", p256dh: "p", auth: "a", reminderLocalTime: "08:00:00", timezone: "Europe/London", reminderDays: [2], active: true, lastSentOn: null };
    const tuesday0805 = new Date("2026-09-29T07:05:00Z"); // 08:05 BST
    assert.equal(isDue(sub, tuesday0805).due, true);
    assert.equal(isDue(sub, new Date("2026-09-28T07:05:00Z")).due, false, "Monday is not a committed day");
    assert.equal(isDue(sub, new Date("2026-09-29T10:30:00Z")).due, false, "past the grace window");
    assert.equal(isDue({ ...sub, timezone: "Not/AZone" }, tuesday0805).due, false);
  });

  it("drops subscriptions the push service says are gone", async () => {
    const subs: ReminderSub[] = [{ endpoint: "gone", p256dh: "p", auth: "a", reminderLocalTime: "00:00", timezone: "UTC", reminderDays: [1, 2, 3, 4, 5, 6, 7], active: true, lastSentOn: null }];
    const r = await runReminders({ now: new Date("2026-09-28T00:10:00Z"), load: async () => subs, send: async () => 410, markSent: async () => {}, deactivate: async (e) => void (subs.find((s) => s.endpoint === e)!.active = false) });
    assert.deepEqual(r, { checked: 1, sent: 0, removed: 1 });
    assert.equal(subs[0].active, false);
  });
});

describe("therapist note and make-it-easier", () => {
  it("the note rejects 121 characters and identifiers", () => {
    assert.equal(noteProblem("x".repeat(NOTE_MAX)), null);
    assert.ok(noteProblem("x".repeat(NOTE_MAX + 1)));
    assert.ok(noteProblem("Call 5550100"));
    assert.ok(noteProblem("Seen on 3/4/2026"));
    assert.equal(noteProblem("Do 2 sets, keep the band light."), null);
  });
  it("dose step-down when there is no easier movement", () => {
    assert.deepEqual(easierDose({ sets: 3, reps: null, holdSeconds: 20 }), { sets: 2, reps: null, holdSeconds: 14 });
  });
});
