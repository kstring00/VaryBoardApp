/** Unit tests for the pure logic (run: pnpm test). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { anchorsInRow, boardAnchors, describePattern, isValidCell } from "../lib/board/geometry";
import { labelProblem, phoneProblem, LABEL_MAX } from "../lib/labels";
import { easierDose, prescription, spokenCue, spokenName } from "../lib/program";
import { buildSteps, totalSeconds } from "../lib/timer";
import { addDays, completionsBetween, dayKey, monthBars, nextSession, startOfWeek, weekBars } from "../lib/progress";
import type { LocalCompletion } from "../lib/client/store";
import type { PatientProgram } from "../lib/types";

describe("board geometry", () => {
  it("rows alternate 2 and 3, 47 per section, 141 / 188", () => {
    assert.equal(anchorsInRow(1), 2);
    assert.equal(anchorsInRow(2), 3);
    assert.equal(boardAnchors("vb").length, 141);
    assert.equal(boardAnchors("xt").length, 188);
  });
  it("validates cells and describes them in plain words", () => {
    assert.ok(isValidCell({ section: 2, row: 16, col: 3 }, "vb"));
    assert.ok(!isValidCell({ section: 2, row: 15, col: 3 }, "vb"), "odd rows have 2 anchors");
    assert.ok(!isValidCell({ section: 4, row: 2, col: 1 }, "vb"), "no fourth section on the Vary Board");
    assert.deepEqual(describePattern([{ section: 2, row: 16, col: 2 }], "vb"), ["Middle section, 16th row up, middle hexagon."]);
    assert.deepEqual(describePattern([{ section: 1, row: 1, col: 1 }], "xt"), ["Bottom section, 1st row up, left hexagon."]);
  });
});

describe("labels keep patient details out", () => {
  it("rejects emails, titles, digit-heavy text and long names", () => {
    assert.equal(labelProblem("Home program A", LABEL_MAX.program), null);
    assert.ok(labelProblem("jane@example.com", 40));
    assert.ok(labelProblem("Mrs Smith", 40));
    assert.ok(labelProblem("DOB 1950", 40));
    assert.ok(labelProblem("x".repeat(41), 40));
    assert.equal(phoneProblem("(555) 010-0000"), null);
    assert.ok(phoneProblem("call me"));
  });
});

describe("prescription and timer", () => {
  it("describes the dose and the spoken cue from the prescription", () => {
    assert.equal(prescription({ sets: 2, reps: 10, holdSeconds: 5 }), "2 sets of 10, hold 5 s");
    assert.equal(prescription({ sets: 3, reps: null, holdSeconds: 20 }), "Hold 20 s, 3 times");
    assert.equal(spokenName("[DRAFT] Climb — standing wall climb"), "standing wall climb");
    assert.equal(spokenCue("Wall climb", { sets: 1, reps: 10, holdSeconds: 5 }), "Wall climb, 10 reps, hold 5");
  });
  it("builds steps from sets x reps x hold, never from the video", () => {
    const steps = buildSteps({ sets: 2, reps: 3, holdSeconds: 5 });
    assert.equal(steps.filter((s) => s.kind === "hold").length, 6);
    assert.equal(steps.filter((s) => s.kind === "rest").length, 1);
    assert.equal(totalSeconds(buildSteps({ sets: 1, reps: null, holdSeconds: 30 })), 30);
  });
  it("makes it easier by one step, never below 1", () => {
    assert.deepEqual(easierDose({ sets: 2, reps: 10, holdSeconds: 5 }), { sets: 1, reps: 7, holdSeconds: 4 });
    assert.deepEqual(easierDose({ sets: 1, reps: 1, holdSeconds: null }), { sets: 1, reps: 1, holdSeconds: null });
  });
});

describe("progress", () => {
  const now = new Date(2026, 8, 26, 18, 0); // Saturday
  const c = (d: Date, sessionId = "s1", done = [true, true]): LocalCompletion => ({
    id: d.toISOString() + sessionId,
    programCode: "VBTEST",
    programSessionId: sessionId,
    sessionName: "x",
    startedAt: d.toISOString(),
    completedAt: d.toISOString(),
    feel: 2,
    items: done.map((x, i) => ({ id: `${i}`, blockId: `${i}`, movementId: "m", movementName: "m", done: x, skipped: !x, skipReason: null, variant: "plan" as const, doseEased: false, easedLogged: false })),
  });
  it("weeks start on Monday and count sessions per day", () => {
    assert.equal(dayKey(startOfWeek(now)), "2026-09-21");
    const bars = weekBars([c(new Date(2026, 8, 22, 9)), c(new Date(2026, 8, 22, 19)), c(new Date(2026, 8, 26, 8), "s1", [true, false])], now);
    assert.equal(bars[1].sessions, 2);
    assert.equal(bars[5].sessions, 1);
    assert.equal(bars[5].share, 0.5);
    assert.ok(bars[6].future);
  });
  it("month view has one bar per week touching the month", () => {
    assert.equal(monthBars([], now).length, 5); // Sep 2026: weeks of Aug 31, Sep 7, 14, 21, 28
  });
  it("next session rotates through the plan", () => {
    const program = { code: "VBTEST", sessions: [{ id: "s1", sort: 1 }, { id: "s2", sort: 2 }] } as unknown as PatientProgram;
    assert.equal(nextSession(program, []).id, "s1");
    assert.equal(nextSession(program, [c(addDays(now, -1), "s1")]).id, "s2");
    assert.equal(nextSession(program, [c(addDays(now, -2), "s1"), c(addDays(now, -1), "s2")]).id, "s1");
  });
  it("filters completions by range", () => {
    const all = [c(new Date(2026, 8, 20)), c(new Date(2026, 8, 21, 1))];
    assert.equal(completionsBetween(all, startOfWeek(now), addDays(startOfWeek(now), 7)).length, 1);
  });
});
