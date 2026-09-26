# Vary Board App

**Your program. Beyond the clinic.** The companion app for the Vary Board, the patented wall-mounted
training board designed by Dr. Eric Santiago, PT, DPT. A therapist builds a program and gives the
patient a 6-character code; the patient follows it at home, one exercise at a time; progress goes
back to the next visit.

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Serwist PWA · Supabase (Postgres, RLS,
Storage, magic-link auth for clinicians) · Vercel (hosting, Analytics, Cron) · Mux or Supabase
Storage for video. Shopify stays the checkout for the board itself; the app has no payments.

## Where things are

| Path | What |
|---|---|
| `app/(vb-app)/app/(tabs)/` | Patient screens with the four tabs: Today `/app`, My plan `/app/plan`, Progress `/app/progress`, Care `/app/care`, plus Settings, library, movement, starter plans, code entry, privacy, in-app 404 |
| `app/(vb-app)/app/session/` | The session player (setup, demo, instructions, timer, feel) |
| `app/(vb-app)/app/start/` | First code entry: habit anchor, commitment, reminder offer |
| `app/(vb-app)/app/clinician/` | Clinician sign-in, programs, builder, adherence, handout PDF |
| `app/(vb-app)/app/api/` | Program lookup by code, reminders (push subscribe/off, cron), demo-backend routes |
| `components/BoardMap.tsx`, `lib/board/geometry.ts` | The board, generated from its real geometry |
| `content/seed.ts` | Genres, draft movements, Eric's starter plan, test fixture. Source of `supabase/seed*.sql` |
| `content/app-copy.json` | New app copy waiting for Eric's review (`reviewedByEric` per string) |
| `supabase/migrations/` | Schema, RLS and RPCs (`…_v1.sql`, then `…_v3_adherence.sql`) |
| `docs/audit-v2.md` | Step 0 audit of the v2 brief |

## Run it

```bash
pnpm install
pnpm dev                 # http://localhost:3000/app, demo backend on (no accounts needed)
pnpm build:demo && pnpm serve:demo   # production build + demo backend on :3100 (what the e2e tests use)
```

Without Supabase keys the app uses the built-in seed. Try code `VBTEST` (test clinician program) or
"Try a starter plan". Clinician mode: `/app/clinician` → "Continue as the test clinician".

## Checks

| Command | What it checks |
|---|---|
| `pnpm typecheck`, `pnpm lint` | TypeScript, ESLint (Next core web vitals) |
| `pnpm test` | Unit tests: geometry, labels and notes, prescription/timer, progress maths, reminder scheduling |
| `pnpm db:test` | Spins up a throwaway local Postgres, applies the migrations + seeds, and tests RLS, RPCs and constraints (needs Postgres 15+ binaries) |
| `pnpm test:e2e` | Playwright at 390 px against the demo build: round trip, offline sync, builder limits and timing, mobile layout, 404, reduced motion |
| `pnpm check:board` | Board geometry: 47 anchors per section in rows of 2 and 3, 141 on the Vary Board, 188 on the XT, and counts what `<BoardMap>` renders |
| `pnpm content:audit` | Content gate: unreviewed movements in published programs; banned copy (cure, heal, guarantee, live longer, diagnos…, the word "free", lorem, outcome and adherence claims, billing terms); images without alt |

`pnpm build` runs `next build --webpack` (the service worker plugin needs webpack).

## Supabase setup

1. Create a project. In SQL editor (or `supabase db push`) run `supabase/migrations/*.sql` in order, then `supabase/seed.sql`.
2. **Only on a preview/test project:** also run `supabase/seed.test.sql` (test clinician + `VBTEST`). Never on production: it is a published clinician program that uses draft movements, so the content audit would fail.
3. Auth → URL configuration: Site URL `https://app.thevaryboard.com`; redirect URLs `https://app.thevaryboard.com/app/auth/callback` and your Vercel preview pattern.
4. Auth → Email templates → Magic Link: use the token-hash link so it works on any device:
   `{{ .SiteURL }}/app/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/app/clinician`
5. Auth → SMTP: set a real sender (Supabase's built-in email is rate-limited).
6. Put the URL, anon key and service-role key in Vercel (see `.env.example`).

Use separate Supabase projects for previews and production, so drafts built on previews never reach production data.

## Domain

The app lives under `/app` in this repo (route group `app/(vb-app)`). To serve it at
`app.thevaryboard.com`: Vercel → Settings → Domains → add `app.thevaryboard.com` to this project
(CNAME to Vercel at the DNS provider) and set `NEXT_PUBLIC_SITE_URL`. The root `/` redirects to `/app`.
To merge into the marketing site repo instead, move `app/(vb-app)`, `components`, `lib`, `content`
and `supabase` across, give the site and the app separate root layouts (`app/(site)/layout.tsx`,
`app/(vb-app)/layout.tsx`), and import the facts from the site's `content/facts.ts` instead of
`content/site.ts`.

## How Eric adds a movement

1. **Film it** portrait-first, no intro, the board clearly visible, and pick a still for the poster.
2. **Create the row** in Supabase → Table editor → `movements`: `name`, `slug` (lowercase-with-dashes),
   `genre_id` (one of the six), `level` 1–3, `board_models` (`{vb,xt}`), `needs_band` / `needs_handrail` /
   `needs_chair`, `cues` (one short line each), `safety_note` (band check, anchor check, "stop if you
   feel sharp pain"), default sets/reps/hold. Leave `reviewed_by_eric` **false**.
3. **Anchor:** open the program builder, add the movement, tap the hexagon in the anchor picker and copy
   the address it shows (for example `{"section":2,"row":16,"col":2}`) into `default_anchor`.
   Section 1 is the bottom section, rows count up from the bottom of each section.
4. **Alternatives:** set `easier_alternative_id` (what "Make it easier" swaps in) and
   `seated_alternative_id` (the chair version) to other movements' ids, if they exist.
5. **Upload video + poster:** `pnpm video:upload <slug> video.mp4 poster.jpg` (Mux when configured,
   otherwise Supabase Storage; the poster is resized and compressed). It never marks the movement reviewed.
6. **Review** it on a preview (drafts show there under a banner). When it is right, set
   `reviewed_by_eric = true`. `reviewed_at` is stamped automatically and the movement appears in production.

Loosen (Joint Mobilizations) has no movements yet; its genre shows "Soon" until Eric adds them.

## How Eric builds a program

Starter plans are programs with no clinician (`clinician_id` null). Build one in the builder like any
clinician (template → edit → create), then in Supabase set its `clinician_id` to null and, once every
movement in it is reviewed, `reviewed_by_eric = true`. Clinicians see it under "Start from" in the builder.

## How Eric (or any clinician) writes a therapist note

On the program page (`/app/clinician/<code>`) → "Note to your patient". Up to 120 characters, shown
under the patient's session card as a quote. Keep it about the exercise ("Keep the band light this
week"): no names, no health details, no dates or phone numbers (the app and the database both refuse
them). The patient sees the new note the next time their app is online.

## How reminders work

- After the first code entry the patient picks **when they will move** (after coffee, after a walk,
  during TV, before bed, or a time) and **commits** to their days. Stored on the phone only.
- **Reminders are opt-in.** On iPhone, web push only works once the app is added to the Home Screen,
  so the app first shows a one-time Add to Home Screen guide. Elsewhere it asks for notification permission.
- The phone's push subscription (endpoint + keys), reminder time, time zone and days are saved in
  `push_subscriptions` through an RPC; no names or health data. Only the server can read that table.
- **Vercel Cron** calls `/app/api/cron/reminders` every 15 minutes with `CRON_SECRET`. It sends at most
  one push per device per day, at or after the chosen local time on a committed day (2-hour grace).
  Subscriptions the push service reports gone are switched off.
- The push has no text in it. The service worker writes "Time to move — {session name}." from what the
  phone knows. Never marketing.
- **Off in one tap:** Settings → Reminders, the notification's "Turn off reminders" action (Android and
  desktop), or the link on Today after opening a reminder (iPhone shows no notification actions).
- **Calendar fallback:** "Add to my calendar" downloads a recurring `.ics` on the committed days.
- Every-15-minute crons need a Vercel Pro plan (Hobby allows one run a day).

## Data and privacy

| On the phone only | Sent to the server |
|---|---|
| First name, appointment, notes, skip reasons, habit + days, settings | Program code, random device id, exercise events (done / skipped / made easier + time), completions (+ feel: easier / same / harder), push subscription if reminders are on |

Clinicians see codes, completions, events and feel for their own codes only (RLS, tested in `tests/db`).
Program and session names and the therapist note are validated to keep identifiers out.

## The board

`lib/board/geometry.ts` is the only source of board drawings: 25 × 8 × 3 in sections, 47 hex anchors
per section in 19 rows alternating 2 and 3 across, gray side rails, a center screw; 3 sections on the
Vary Board, 4 on the XT. **TODO: reference photo.** `/public/board/reference.jpg` is not in the repo
yet; until it is, the board is a flat schematic. When it lands it shows behind the Today card and the
session setup automatically; then check the row pattern and proportions against it.
