/**
 * Seed content. Source for `supabase/seed.sql` and `supabase/seed.test.sql`
 * (`pnpm db:seed:gen`) and for the app's built-in data when Supabase is not configured.
 *
 * Rules
 *  - The six genres are fixed. Never add or rename one.
 *  - Every placeholder movement is `reviewedByEric: false` and named "[DRAFT] Genre — what".
 *    The production content gate hides it until Eric reviews it in Supabase.
 *  - Loosen (Joint Mobilizations) ships with zero movements until Eric defines them.
 *  - Copy describes positions, movements and effort. No outcomes, no health claims.
 *  - Every band or anchor setup carries safety guidance (band check, anchor check, stop if
 *    sharp pain), reviewed by Eric like all copy.
 *  - No video yet: `videoUrl` stays null and the app shows a mint hex tile with the name.
 */
import type { AnchorCell, Genre, GenreSlug, Movement } from "@/lib/types";

export const GENRES: Genre[] = [
  { id: "00000000-0000-4000-8000-000000000001", slug: "climb", name: "Climb", clinicalName: "Active-Assisted Range of Motion", description: "Walk your hands up the hexagons, using the board as a guide as you reach.", sort: 1 },
  { id: "00000000-0000-4000-8000-000000000002", slug: "strengthen", name: "Strengthen", clinicalName: "Strengthening", description: "Clip a band to an anchor point and push, pull or press against it.", sort: 2 },
  { id: "00000000-0000-4000-8000-000000000003", slug: "stretch", name: "Stretch", clinicalName: "Stretching", description: "Settle into a gentle stretch with a band or handhold at the height you choose.", sort: 3 },
  { id: "00000000-0000-4000-8000-000000000004", slug: "loosen", name: "Loosen", clinicalName: "Joint Mobilizations", description: "Slow, guided joint movements. Dr. Eric is preparing these.", sort: 4 },
  { id: "00000000-0000-4000-8000-000000000005", slug: "steady", name: "Steady", clinicalName: "Balance Training", description: "Practice standing and stepping with the handrails within reach.", sort: 5 },
  { id: "00000000-0000-4000-8000-000000000006", slug: "rise", name: "Rise", clinicalName: "Transfer Training", description: "Practice sit-to-stand, reaching and stepping with the rails for support.", sort: 6 },
];

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const a = (section: number, row: number, col: number): AnchorCell => ({ section, row, col });

const STOP = "Stop if you feel sharp pain, and check with your therapist.";
const BAND = "Before each set, check the band for nicks or tears and make sure the carabiner is closed on the anchor.";
const ANCHOR = "Check the anchor is seated in the hexagon before you pull.";

function m(n: number, genreSlug: GenreSlug, name: string, slug: string, f: Omit<Movement, "id" | "genreSlug" | "name" | "slug" | "videoUrl" | "posterUrl" | "reviewedByEric" | "reviewedAt" | "easierAlternativeId"> & { easierAlternativeId?: string | null }): Movement {
  return { id: id(n), genreSlug, name, slug, videoUrl: null, posterUrl: null, reviewedByEric: false, reviewedAt: null, easierAlternativeId: null, ...f };
}

export const MOVEMENTS: Movement[] = [
  m(1, "climb", "[DRAFT] Climb — standing wall climb", "draft-climb-standing-wall-climb", {
    level: 2, boardModels: ["vb", "xt"], needsBand: false, needsHandrail: false, needsChair: false,
    defaultAnchor: a(3, 6, 2), seatedAlternativeId: id(3), easierAlternativeId: id(9),
    cues: ["Stand facing the board, feet hip-width apart.", "Walk your fingers up one hexagon at a time toward the marked hexagon.", "Pause where it feels like a comfortable reach, then walk back down."],
    safetyNote: `Move slowly and stay within a comfortable range. ${STOP}`, defaultSets: 2, defaultReps: 10, defaultHoldSeconds: 5,
  }),
  m(2, "climb", "[DRAFT] Climb — side wall walk", "draft-climb-side-wall-walk", {
    level: 2, boardModels: ["vb", "xt"], needsBand: false, needsHandrail: false, needsChair: false,
    defaultAnchor: a(3, 2, 1), seatedAlternativeId: id(3), easierAlternativeId: id(9),
    cues: ["Stand side-on to the board, an arm's length away.", "Walk the fingers of the near hand up the hexagons.", "Pause at the marked hexagon or lower, then walk back down and turn around."],
    safetyNote: `Keep your shoulders relaxed. ${STOP}`, defaultSets: 2, defaultReps: 8, defaultHoldSeconds: 5,
  }),
  m(3, "climb", "[DRAFT] Climb — seated wall walk", "draft-climb-seated-wall-walk", {
    level: 1, boardModels: ["vb", "xt"], needsBand: false, needsHandrail: false, needsChair: true,
    defaultAnchor: a(2, 14, 2), seatedAlternativeId: null,
    cues: ["Sit tall in a sturdy chair facing the board, close enough to touch it.", "Walk your fingers up one hexagon at a time.", "Pause at the highest hexagon that feels comfortable, then walk back down."],
    safetyNote: `Use a chair that will not slide. ${STOP}`, defaultSets: 2, defaultReps: 8, defaultHoldSeconds: 3,
  }),
  m(4, "stretch", "[DRAFT] Stretch — overhead band reach", "draft-stretch-overhead-band-reach", {
    level: 1, boardModels: ["vb", "xt"], needsBand: true, needsHandrail: false, needsChair: false,
    defaultAnchor: a(3, 16, 2), seatedAlternativeId: null,
    cues: ["Clip a band high on the board. You can stand or sit.", "Hold the loop and let it draw your arm gently upward.", "Breathe slowly while you hold, then switch arms."],
    safetyNote: `${BAND} ${STOP}`, defaultSets: 2, defaultReps: null, defaultHoldSeconds: 20,
  }),
  m(5, "strengthen", "[DRAFT] Strengthen — standing band row", "draft-strengthen-standing-band-row", {
    level: 1, boardModels: ["vb", "xt"], needsBand: true, needsHandrail: false, needsChair: false,
    defaultAnchor: a(2, 16, 2), seatedAlternativeId: id(6),
    cues: ["Clip the band at chest height and step back until it is lightly taut.", "Draw both ends back toward your ribs, elbows close to your sides.", "Return slowly over a count of three."],
    safetyNote: `${BAND} ${ANCHOR} ${STOP}`, defaultSets: 2, defaultReps: 10, defaultHoldSeconds: null,
  }),
  m(6, "strengthen", "[DRAFT] Strengthen — seated band row", "draft-strengthen-seated-band-row", {
    level: 1, boardModels: ["vb", "xt"], needsBand: true, needsHandrail: false, needsChair: true,
    defaultAnchor: a(2, 6, 2), seatedAlternativeId: null,
    cues: ["Sit tall in a sturdy chair facing the board.", "Clip the band at chest height when seated.", "Draw both ends back toward your ribs, then return slowly."],
    safetyNote: `${BAND} ${ANCHOR} ${STOP}`, defaultSets: 2, defaultReps: 10, defaultHoldSeconds: null,
  }),
  m(7, "steady", "[DRAFT] Steady — heel-to-toe stand", "draft-steady-heel-to-toe-stand", {
    level: 1, boardModels: ["vb", "xt"], needsBand: false, needsHandrail: true, needsChair: false,
    defaultAnchor: a(2, 8, 2), seatedAlternativeId: null, easierAlternativeId: id(10),
    cues: ["Hold both rails.", "Place one foot directly in front of the other.", "Hold, then switch feet. Lighten your grip only when you feel ready."],
    safetyNote: `Keep both hands on the rails until your therapist says otherwise. Check the rails are firmly attached before you start. ${STOP}`, defaultSets: 3, defaultReps: null, defaultHoldSeconds: 20,
  }),
  m(8, "rise", "[DRAFT] Rise — sit-to-stand with the rails", "draft-rise-sit-to-stand-with-the-rails", {
    level: 1, boardModels: ["vb", "xt"], needsBand: false, needsHandrail: true, needsChair: true,
    defaultAnchor: a(2, 4, 2), seatedAlternativeId: null,
    cues: ["Set a sturdy chair in front of the board.", "Hold the rails, lean forward slightly and stand up slowly.", "Sit back down with control."],
    safetyNote: `Use a chair that will not slide, and check the rails are firmly attached. ${STOP}`, defaultSets: 2, defaultReps: 8, defaultHoldSeconds: null,
  }),
  m(9, "climb", "[DRAFT] Climb — low wall walk", "draft-climb-low-wall-walk", {
    level: 1, boardModels: ["vb", "xt"], needsBand: false, needsHandrail: false, needsChair: false,
    defaultAnchor: a(2, 16, 2), seatedAlternativeId: id(3),
    cues: ["Stand facing the board, feet hip-width apart.", "Walk your fingers up to chest height, one hexagon at a time.", "Walk them back down slowly."],
    safetyNote: `Move slowly and stay within a comfortable range. ${STOP}`, defaultSets: 2, defaultReps: 8, defaultHoldSeconds: 3,
  }),
  m(10, "steady", "[DRAFT] Steady — feet-together stand", "draft-steady-feet-together-stand", {
    level: 1, boardModels: ["vb", "xt"], needsBand: false, needsHandrail: true, needsChair: false,
    defaultAnchor: a(2, 8, 2), seatedAlternativeId: null,
    cues: ["Hold both rails.", "Bring your feet together and stand tall.", "Hold, breathing slowly."],
    safetyNote: `Keep both hands on the rails. Check the rails are firmly attached before you start. ${STOP}`, defaultSets: 3, defaultReps: null, defaultHoldSeconds: 20,
  }),
];

export interface SeedBlock {
  movementSlug: string;
  sets: number | null;
  reps: number | null;
  holdSeconds: number | null;
  bandColor: string | null;
  anchor: AnchorCell | null;
}
export interface SeedSession {
  id: string;
  name: string;
  estMinutes: number;
  blocks: (SeedBlock & { id: string })[];
}
export interface SeedProgram {
  id: string;
  code: string;
  name: string;
  clinicianId: string | null;
  clinicName: string | null;
  clinicPhone: string | null;
  therapistNote: string | null;
  daysPerWeek: number;
  /** Starter programs only: production shows them once Eric has reviewed them. */
  reviewedByEric: boolean;
  sessions: SeedSession[];
}

const shoulderBlocks: SeedBlock[] = [
  { movementSlug: "draft-climb-standing-wall-climb", sets: 2, reps: 10, holdSeconds: 5, bandColor: null, anchor: a(3, 6, 2) },
  { movementSlug: "draft-climb-side-wall-walk", sets: 2, reps: 8, holdSeconds: 5, bandColor: null, anchor: a(3, 2, 1) },
  { movementSlug: "draft-stretch-overhead-band-reach", sets: 2, reps: null, holdSeconds: 20, bandColor: "Yellow", anchor: a(3, 16, 2) },
  { movementSlug: "draft-strengthen-standing-band-row", sets: 2, reps: 10, holdSeconds: null, bandColor: "Yellow", anchor: a(2, 16, 2) },
];

const withIds = (prefix: string, blocks: SeedBlock[]) => blocks.map((b, i) => ({ ...b, id: `${prefix}${String(i + 1).padStart(4, "0")}` }));

/** Eric's starter plans (clinician_id null). Seeded unreviewed: hidden in production. */
export const STARTER_PROGRAMS: SeedProgram[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    code: "START1",
    name: "[DRAFT] Shoulder mobility",
    clinicianId: null,
    clinicName: null,
    clinicPhone: null,
    therapistNote: null,
    daysPerWeek: 3,
    reviewedByEric: false,
    sessions: [{ id: "21000000-0000-4000-8000-000000000001", name: "[DRAFT] Shoulder mobility", estMinutes: 15, blocks: withIds("30000000-0000-4000-8000-00000001", shoulderBlocks) }],
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    code: "START2",
    name: "[DRAFT] Start here: your first weeks on the board",
    clinicianId: null,
    clinicName: null,
    clinicPhone: null,
    therapistNote: null,
    daysPerWeek: 3,
    reviewedByEric: false,
    sessions: [
      {
        id: "21000000-0000-4000-8000-000000000002",
        name: "[DRAFT] Day A: Reach",
        estMinutes: 8,
        blocks: withIds("30000000-0000-4000-8000-00000002", [
          { movementSlug: "draft-climb-low-wall-walk", sets: 2, reps: 8, holdSeconds: 3, bandColor: null, anchor: null },
          { movementSlug: "draft-climb-standing-wall-climb", sets: 2, reps: 8, holdSeconds: 5, bandColor: null, anchor: null },
          { movementSlug: "draft-stretch-overhead-band-reach", sets: 2, reps: null, holdSeconds: 20, bandColor: null, anchor: null },
        ]),
      },
      {
        id: "21000000-0000-4000-8000-000000000003",
        name: "[DRAFT] Day B: Strength",
        estMinutes: 8,
        blocks: withIds("30000000-0000-4000-8000-00000003", [
          { movementSlug: "draft-strengthen-standing-band-row", sets: 2, reps: 10, holdSeconds: null, bandColor: null, anchor: null },
          { movementSlug: "draft-rise-sit-to-stand-with-the-rails", sets: 2, reps: 8, holdSeconds: null, bandColor: null, anchor: null },
          { movementSlug: "draft-climb-side-wall-walk", sets: 2, reps: 8, holdSeconds: 3, bandColor: null, anchor: null },
        ]),
      },
      {
        id: "21000000-0000-4000-8000-000000000004",
        name: "[DRAFT] Day C: Steady",
        estMinutes: 8,
        blocks: withIds("30000000-0000-4000-8000-00000004", [
          { movementSlug: "draft-steady-feet-together-stand", sets: 3, reps: null, holdSeconds: 20, bandColor: null, anchor: null },
          { movementSlug: "draft-steady-heel-to-toe-stand", sets: 3, reps: null, holdSeconds: 20, bandColor: null, anchor: null },
          { movementSlug: "draft-rise-sit-to-stand-with-the-rails", sets: 2, reps: 8, holdSeconds: null, bandColor: null, anchor: null },
        ]),
      },
    ],
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    code: "START3",
    name: "[DRAFT] Seated plan",
    clinicianId: null,
    clinicName: null,
    clinicPhone: null,
    therapistNote: null,
    daysPerWeek: 3,
    reviewedByEric: false,
    sessions: [
      {
        id: "21000000-0000-4000-8000-000000000005",
        name: "[DRAFT] Seated reach",
        estMinutes: 6,
        blocks: withIds("30000000-0000-4000-8000-00000005", [
          { movementSlug: "draft-climb-seated-wall-walk", sets: 2, reps: 8, holdSeconds: 3, bandColor: null, anchor: null },
          { movementSlug: "draft-stretch-overhead-band-reach", sets: 2, reps: null, holdSeconds: 20, bandColor: null, anchor: null },
        ]),
      },
      {
        id: "21000000-0000-4000-8000-000000000006",
        name: "[DRAFT] Seated strength",
        estMinutes: 6,
        blocks: withIds("30000000-0000-4000-8000-00000006", [
          { movementSlug: "draft-strengthen-seated-band-row", sets: 2, reps: 10, holdSeconds: null, bandColor: null, anchor: null },
          { movementSlug: "draft-climb-seated-wall-walk", sets: 2, reps: 8, holdSeconds: 3, bandColor: null, anchor: null },
        ]),
      },
    ],
  },
];

/**
 * Test fixture: one clinician and one code (VBTEST) for the round-trip test. Lives in
 * supabase/seed.test.sql and the local demo backend only. Never load it into production.
 */
export const TEST_CLINICIAN = {
  id: "c0000000-0000-4000-8000-000000000001",
  email: "test-clinician@example.com",
  displayName: "Test Clinician",
  clinicName: "Test Clinic",
} as const;

export const TEST_PROGRAMS: SeedProgram[] = [
  {
    id: "20000000-0000-4000-8000-000000000101",
    code: "VBTEST",
    name: "Home program A",
    clinicianId: TEST_CLINICIAN.id,
    clinicName: TEST_CLINICIAN.clinicName,
    clinicPhone: "555-0100",
    therapistNote: "Keep the band light this week. Slow and steady beats fast.",
    daysPerWeek: 4,
    reviewedByEric: false,
    sessions: [
      { id: "21000000-0000-4000-8000-000000000101", name: "Shoulder mobility", estMinutes: 15, blocks: withIds("30000000-0000-4000-8000-00000101", shoulderBlocks) },
      {
        id: "21000000-0000-4000-8000-000000000102",
        name: "Standing and balance",
        estMinutes: 10,
        blocks: withIds("30000000-0000-4000-8000-00000102", [
          { movementSlug: "draft-steady-heel-to-toe-stand", sets: 3, reps: null, holdSeconds: 20, bandColor: null, anchor: a(2, 8, 2) },
          { movementSlug: "draft-rise-sit-to-stand-with-the-rails", sets: 2, reps: 8, holdSeconds: null, bandColor: null, anchor: a(2, 4, 2) },
        ]),
      },
    ],
  },
];
