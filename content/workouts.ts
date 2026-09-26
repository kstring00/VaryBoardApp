/**
 * Self-guided workouts: press play and follow along, no therapist code needed (the TRX-style
 * library). Each workout is a short list of movements from the movement library with a dose.
 *
 * Rules (same as content/seed.ts)
 *  - Built only from movements in the library. A workout shows in production only when the
 *    workout itself AND every movement in it are reviewed by Eric (lib/workouts.ts gates it).
 *  - Unreviewed workouts are named "[DRAFT] ..." and stay hidden in production.
 *  - Blurbs describe what you do and how long it takes. No outcomes, no health claims.
 *  - At most six exercises, and most workouts under ten minutes: short is easier to keep doing.
 *  - One filmed movement feeds many workouts, so every video Eric records multiplies.
 */
import type { SeedBlock } from "@/content/seed";

export interface SeedWorkout {
  slug: string;
  name: string;
  blurb: string;
  level: 1 | 2 | 3;
  reviewedByEric: boolean;
  blocks: SeedBlock[];
}

const b = (movementSlug: string, sets: number, reps: number | null, holdSeconds: number | null): SeedBlock => ({ movementSlug, sets, reps, holdSeconds, bandColor: null, anchor: null });

export const WORKOUTS: SeedWorkout[] = [
  {
    slug: "morning-reach",
    name: "[DRAFT] Morning reach",
    blurb: "Three easy movements to start the day: walk your hands up the board, then stand tall at the rails.",
    level: 1,
    reviewedByEric: false,
    blocks: [b("draft-climb-low-wall-walk", 2, 6, 3), b("draft-climb-side-wall-walk", 1, 6, 3), b("draft-steady-feet-together-stand", 2, null, 20)],
  },
  {
    slug: "seated-reach-and-row",
    name: "[DRAFT] Seated reach and row",
    blurb: "Everything from a sturdy chair: a wall walk, a band row and an overhead reach.",
    level: 1,
    reviewedByEric: false,
    blocks: [b("draft-climb-seated-wall-walk", 2, 8, 3), b("draft-strengthen-seated-band-row", 2, 10, null), b("draft-stretch-overhead-band-reach", 2, null, 20)],
  },
  {
    slug: "steady-at-the-rails",
    name: "[DRAFT] Steady at the rails",
    blurb: "Standing practice with both hands on the rails, finishing with sit-to-stands.",
    level: 1,
    reviewedByEric: false,
    blocks: [b("draft-steady-feet-together-stand", 3, null, 20), b("draft-steady-heel-to-toe-stand", 3, null, 20), b("draft-rise-sit-to-stand-with-the-rails", 2, 8, null)],
  },
  {
    slug: "get-up-and-go",
    name: "[DRAFT] Up from the chair",
    blurb: "Sit-to-stands with the rails, a steady stand, then a gentle reach up the board.",
    level: 1,
    reviewedByEric: false,
    blocks: [b("draft-rise-sit-to-stand-with-the-rails", 3, 8, null), b("draft-steady-feet-together-stand", 2, null, 30), b("draft-climb-low-wall-walk", 2, 8, 3)],
  },
  {
    slug: "band-basics",
    name: "[DRAFT] Band basics",
    blurb: "Clip a band to the board: rows, an overhead reach and a side wall walk.",
    level: 1,
    reviewedByEric: false,
    blocks: [b("draft-strengthen-standing-band-row", 3, 10, null), b("draft-stretch-overhead-band-reach", 3, null, 30), b("draft-climb-side-wall-walk", 2, 8, 5)],
  },
  {
    slug: "reach-and-hold",
    name: "[DRAFT] Reach and hold",
    blurb: "Longer holds at the top of each reach, side-on and facing the board.",
    level: 2,
    reviewedByEric: false,
    blocks: [b("draft-climb-side-wall-walk", 3, 8, 5), b("draft-climb-standing-wall-climb", 3, 8, 5), b("draft-stretch-overhead-band-reach", 3, null, 30)],
  },
  {
    slug: "full-board-tour",
    name: "[DRAFT] Full board tour",
    blurb: "One movement from each kind that is ready: Climb, Strengthen, Stretch, Steady and Rise.",
    level: 2,
    reviewedByEric: false,
    blocks: [
      b("draft-climb-standing-wall-climb", 2, 10, 5),
      b("draft-strengthen-standing-band-row", 2, 12, null),
      b("draft-stretch-overhead-band-reach", 2, null, 30),
      b("draft-steady-heel-to-toe-stand", 3, null, 30),
      b("draft-rise-sit-to-stand-with-the-rails", 2, 10, null),
    ],
  },
  {
    slug: "longer-strength-and-balance",
    name: "[DRAFT] Longer strength and balance",
    blurb: "A longer session for days you have the time: rows, reaches, rail work and sit-to-stands.",
    level: 2,
    reviewedByEric: false,
    blocks: [
      b("draft-strengthen-standing-band-row", 3, 12, null),
      b("draft-climb-standing-wall-climb", 3, 10, 5),
      b("draft-steady-heel-to-toe-stand", 3, null, 30),
      b("draft-rise-sit-to-stand-with-the-rails", 3, 10, null),
      b("draft-stretch-overhead-band-reach", 3, null, 30),
    ],
  },
];
