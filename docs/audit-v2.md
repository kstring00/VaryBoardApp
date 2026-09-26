# Step 0 audit: v2 brief vs. what is built

Audited 2026-09-26 on commit `3a65774`, before any v3 work. DONE = built and checked; PARTIAL = built
with a gap; MISSING = not built. Gaps marked **fixed in Step 0** were closed in the commit that adds
this file; the rest are noted with where they are handled.

| # | v2 item | Status | Notes |
|---|---|---|---|
| 1 | Four tabs exactly (Today, My plan, Progress, Care) with house / clipboard / bars / two-people icons | DONE | `components/app/TabBar.tsx`. Profile icon opens `/app/settings` (not a tab). |
| 2 | Today: mark + wordmark, profile icon, greeting with first name, "Keep your recovery moving." | DONE | First name is device-only (Settings). |
| 3 | Today: next-session card over the **real board photo** | PARTIAL | `/public/board/reference.jpg` is not in the repo or the site repo. Card uses the geometry-generated board; switches to the photo automatically when the file is added (`lib/board/photo.ts`). Blocked on the photo. |
| 4 | Today: weekly hex row "3 of 4 sessions complete"; next appointment row | DONE | |
| 5 | Session: "Exercise 1 of 4", "Set up your board.", BoardMap with lit anchor + "Your saved anchor." | DONE | Photo overlay PARTIAL (same missing photo as #3). |
| 6 | Session: Setup / Demo / Instructions tabs, "Setup ready", "Continue to exercise" | DONE | |
| 7 | Session: timer/rep counter, Next/Done, "How did movement feel?" Easier/Same/Harder with faces, hex fill | DONE | |
| 8 | Progress: headline, Week/Month, big stat, hex bars, feel trend, export summary PDF | DONE | PDF is made on the device (`lib/client/export-summary.ts`). |
| 9 | My plan: sessions with exercises grouped by genre chip; empty state | DONE | |
| 10 | Care: code entry, clinic name/phone, appointment picker, device-only notes, military + VA line | DONE | Shop link text changes to "Shop Vary Board" in v3. |
| 11 | Clinician: magic link, builder (sets/reps/hold, band, AnchorPicker), code, handout with QR, adherence, PHI warning | PARTIAL | All built. Magic link untested: needs a real Supabase project (no Docker/GoTrue here). Tested through the local demo backend instead. |
| 12 | Six genres exact; Loosen ships with zero movements | DONE | Asserted by `content:audit` and DB tests. |
| 13 | Hard rule: personalization on device only | DONE | Server receives code, device id, completions, feel. |
| 14 | Hard rule: board accuracy (25 x 8 x 3, 47/section, 2/3 rows, rails, center screw, 141/188) | DONE | `pnpm check:board`. Photo overlay PARTIAL (#3). |
| 15 | Hard rule: no AI people; mint hex tile placeholder | DONE | `components/HexTile.tsx`. |
| 16 | Hard rule: no health claims / diagnosis / guarantees / lifespan | DONE | `pnpm content:audit`. |
| 17 | Hard rule: reviewed_by_eric, production gate, audit fails on published drafts | DONE | `lib/content-gate.ts`, `content_audit()` RPC, `pnpm content:audit`. |
| 18 | One primary CTA per screen; reduced motion everywhere | DONE | Re-checked in final verification. |
| 19 | Stack: App Router at `/app`, TS, Tailwind, Serwist PWA, Supabase, Vercel Analytics | DONE | |
| 20 | Video: Mux if `MUX_TOKEN_ID`, else Supabase Storage | PARTIAL | Playback handles both. `pnpm video:upload` was declared in package.json but the script did not exist. **Fixed in Step 0.** |
| 21 | Data model: genres, movements, programs, program_sessions, session_blocks, completions, clinicians | DONE | Plus `completion_items` (per-exercise done/skipped/eased), added so the therapist sees "make it easier". |
| 22 | `seated_alternative_id` (constraint #4) not defined in the v2 data model | DONE | Already added to `movements` in the v2 migration. The v3 migration re-declares it with `add column if not exists`, so both paths agree. |
| 23 | RLS: own programs only; completions insert-only by code; clinicians read only their codes | DONE | 12 DB tests on real Postgres (`pnpm db:test`). |
| 24 | Components list (BoardMap ... ExportSummaryPDF) | DONE | ContentGate and ExportSummaryPDF are modules (`lib/content-gate.ts`, `lib/client/export-summary.ts`), not React components. |
| 25 | Seed: six genres, starter "Shoulder mobility" (4 [DRAFT] exercises), seeded clinician + code | DONE | Test clinician + `VBTEST` live in `supabase/seed.test.sql` (never production). |
| 26 | Scripts: content:audit, check:board | DONE | |
| 27 | C1 timers follow the prescription; audio cue names exercise + target | DONE | `lib/timer.ts`, spoken cue via speech synthesis. |
| 28 | C2 skip one / reorder one, reason optional | DONE | Skip today, Do this later; reasons device-only. |
| 29 | C3 never lose a rep (save each exercise immediately; survive lock/offline; queue and sync) | PARTIAL | Built (active session persisted after every step, outbox). Untested. v3 moves per-exercise events to IndexedDB; covered by the v3 offline test. |
| 30 | C4 make it easier in one tap; therapist sees it; seated alternatives | DONE | v3 changes it to swap to `easier_alternative_id`. |
| 31 | C5 portrait-first video, no intros, no audio focus | DONE | Muted by default. |
| 32 | C6 money trust rules | DONE | No payments in v1. |
| 33 | C7 no cross-sell; one quiet Shop link in Care | DONE | |
| 34 | C8 clinician builds a program in under 2 minutes (templates, duplicate, reorder) | PARTIAL | Built; the timing test was missing. Written with the v3 tests. |
| 35 | C9 a human is reachable (clinic + support phone in Care) | DONE | |
| 36 | C10 safety guidance on every band/anchor setup | DONE | Draft copy, pending Eric. |
| 37 | `pnpm test` unit tests | MISSING | Script pointed at an empty folder. **Fixed in Step 0** (progress, timer, labels, program, geometry, audit rules). |
| 38 | Launch checklist verification (Playwright mobile, Lighthouse, round trip, README, HANDOFF) | MISSING | Done in final verification, after v3, so the docs describe the final build. |
