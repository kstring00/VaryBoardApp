import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOVEMENTS } from "../content/seed";
import { WORKOUTS } from "../content/workouts";
import { allSeated, equipmentLine, filterWorkouts, inTime, metaFor, NO_FILTERS, planMeta, recommendPlan, recommendWorkouts, type WorkoutMeta } from "../lib/workout-logic";
import type { PatientProgram, PlanSession } from "../lib/types";

const bySlug = new Map(MOVEMENTS.map((m) => [m.slug, m]));
function session(slugs: string[]): PlanSession {
  return {
    id: "s",
    name: "s",
    sort: 1,
    estMinutes: null,
    blocks: slugs.map((slug, i) => ({ id: `b${i}`, movementId: bySlug.get(slug)!.id, sort: i + 1, sets: 2, reps: 8, holdSeconds: 3, bandColor: null, anchor: null, movement: bySlug.get(slug)!, seatedAlternative: null, easierAlternative: null })),
  };
}
const metas: WorkoutMeta[] = WORKOUTS.map((w) => {
  const s: PlanSession = { ...session(w.blocks.map((b) => b.movementSlug)), blocks: w.blocks.map((b, i) => ({ id: `b${i}`, movementId: bySlug.get(b.movementSlug)!.id, sort: i + 1, sets: b.sets, reps: b.reps, holdSeconds: b.holdSeconds, bandColor: null, anchor: null, movement: bySlug.get(b.movementSlug)!, seatedAlternative: null, easierAlternative: null })) };
  return metaFor(w.slug, w.name, w.blurb, w.level, s);
});

describe("workouts content", () => {
  it("every workout uses known movements, six exercises at most, drafts labeled", () => {
    for (const w of WORKOUTS) {
      for (const b of w.blocks) assert.ok(bySlug.has(b.movementSlug), `${w.slug}: ${b.movementSlug}`);
      assert.ok(w.blocks.length <= 6, w.slug);
      if (!w.reviewedByEric) assert.ok(w.name.startsWith("[DRAFT] "), w.slug);
    }
    assert.equal(new Set(WORKOUTS.map((w) => w.slug)).size, WORKOUTS.length, "unique slugs");
  });
  it("covers every length bucket and has a seated and a no-band option", () => {
    assert.ok(metas.some((m) => inTime(m.minutes, "short")));
    assert.ok(metas.some((m) => inTime(m.minutes, "medium")));
    assert.ok(metas.some((m) => inTime(m.minutes, "long")));
    assert.ok(metas.some((m) => m.seated));
    assert.ok(metas.some((m) => !m.needsBand));
  });
});

describe("seated rule", () => {
  it("a chair workout with a stand-or-sit stretch is seated; anything with rails or a standing movement is not", () => {
    assert.equal(allSeated(session(["draft-climb-seated-wall-walk", "draft-strengthen-seated-band-row", "draft-stretch-overhead-band-reach"]).blocks.map((b) => b.movement)), true);
    assert.equal(allSeated(session(["draft-climb-seated-wall-walk", "draft-rise-sit-to-stand-with-the-rails"]).blocks.map((b) => b.movement)), false);
    assert.equal(allSeated(session(["draft-climb-seated-wall-walk", "draft-climb-low-wall-walk"]).blocks.map((b) => b.movement)), false);
    assert.equal(allSeated(session(["draft-stretch-overhead-band-reach"]).blocks.map((b) => b.movement)), false, "needs at least one chair movement");
  });
});

describe("filters", () => {
  it("time buckets", () => {
    assert.equal(inTime(4, "short"), true);
    assert.equal(inTime(5, "short"), false);
    assert.equal(inTime(5, "medium"), true);
    assert.equal(inTime(10, "medium"), true);
    assert.equal(inTime(11, "long"), true);
  });
  it("seated and no-band filters only return matching workouts", () => {
    for (const w of filterWorkouts(metas, { ...NO_FILTERS, seated: true })) assert.ok(w.seated);
    for (const w of filterWorkouts(metas, { ...NO_FILTERS, noBand: true })) assert.ok(!w.needsBand);
    for (const w of filterWorkouts(metas, { ...NO_FILTERS, genre: "steady" })) assert.ok(w.genres.includes("steady"));
    assert.equal(filterWorkouts(metas, NO_FILTERS).length, metas.length);
  });
  it("equipment line", () => {
    assert.equal(equipmentLine({ needsBand: false, needsRails: false, needsChair: false }), "Just the board");
    assert.equal(equipmentLine({ needsBand: true, needsRails: true, needsChair: false }), "Band · Rails");
  });
});

describe("find your starting point", () => {
  it("seated answers only ever get seated workouts", () => {
    for (const goal of ["reach", "strength", "balance", "stand"] as const) for (const w of recommendWorkouts(metas, { goal, position: "seated", minutes: 10 })) assert.ok(w.seated, `${goal}: ${w.slug}`);
  });
  it("standing answers never get a seated workout, and the first pick matches the goal", () => {
    const r = recommendWorkouts(metas, { goal: "balance", position: "standing", minutes: 5 });
    assert.ok(r.length > 0);
    assert.ok(r.every((w) => !w.seated));
    assert.ok(r[0].genres.includes("steady"));
  });
  it("short time prefers short workouts", () => {
    const [first] = recommendWorkouts(metas, { goal: "reach", position: "either", minutes: 5 });
    assert.ok(first.minutes <= 8, `${first.slug} is ${first.minutes} min`);
  });
  it("plan: seated plan for seated answers, otherwise the plan with the most sessions", () => {
    const mk = (code: string, slugs: string[][]): PatientProgram => ({ code, name: code, isStarter: true, clinicName: null, clinicPhone: null, assignedBy: null, therapistNote: null, noteUpdatedAt: null, daysPerWeek: 3, sessions: slugs.map((s) => session(s)) });
    const plans = [
      planMeta(mk("A", [["draft-climb-standing-wall-climb"]])),
      planMeta(mk("B", [["draft-climb-low-wall-walk"], ["draft-steady-heel-to-toe-stand"], ["draft-rise-sit-to-stand-with-the-rails"]])),
      planMeta(mk("C", [["draft-climb-seated-wall-walk"], ["draft-strengthen-seated-band-row"]])),
    ];
    assert.equal(recommendPlan(plans, { goal: "reach", position: "seated", minutes: 5 })?.code, "C");
    assert.equal(recommendPlan(plans, { goal: "reach", position: "standing", minutes: 5 })?.code, "B");
    assert.equal(recommendPlan([], { goal: "reach", position: "standing", minutes: 5 }), null);
  });
});
