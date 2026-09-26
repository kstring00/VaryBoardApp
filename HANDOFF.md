# Handoff: Vary Board App

Plain-English list of every account, key and switch the app depends on. All accounts should be in
Eric's (Vary Systems') name. Keys live only in Vercel environment variables and the Supabase
dashboard, never in the repository.

## Accounts

| Service | What it does for the app | Owner | Notes |
|---|---|---|---|
| GitHub `kstring00/VaryBoardApp` | Source code; every push builds a Vercel preview | Transfer to Vary Systems | Pull requests only; nothing merges without review |
| Vercel project | Hosting, previews, Analytics, Cron | Vary Systems | Cron every 15 min needs the **Pro** plan |
| Supabase project (production) | Postgres, RLS, Storage bucket `movement-media`, clinician magic-link auth | Vary Systems | Separate project for previews/tests |
| Supabase project (preview) | Same, with `seed.test.sql` loaded | Vary Systems | Test code `VBTEST` lives here only |
| Email sender (SMTP) for magic links | Sends clinician sign-in emails | Vary Systems | e.g. Resend; set under Supabase → Auth → SMTP |
| Mux (optional) | Video hosting/streaming | Vary Systems | Only if `MUX_TOKEN_ID` is set; otherwise Supabase Storage |
| DNS for thevaryboard.com | `app.thevaryboard.com` → Vercel | Vary Systems | CNAME shown in Vercel → Domains |

## Keys and environment variables (Vercel → Settings → Environment Variables)

| Variable | Where it comes from | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project settings → API | Production + Preview (different projects) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API (anon, public) | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API (service role). **Secret.** Used by the reminder cron and `pnpm content:audit` | Production + Preview |
| `NEXT_PUBLIC_SITE_URL` | `https://app.thevaryboard.com` | Production |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` (public half) | Production + Preview |
| `VAPID_PRIVATE_KEY` | Same command (private half). **Secret.** Changing it invalidates every reminder subscription | Production + Preview |
| `VAPID_SUBJECT` | `mailto:info@varysystems.com` | Production + Preview |
| `CRON_SECRET` | Any long random string (`openssl rand -hex 32`). Vercel sends it to the cron route | Production |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` | Mux → Settings → Access tokens (optional) | Local machine for `pnpm video:upload` |
| `VB_HIDE_DRAFTS` | `true` hides drafts on previews too (default: previews show them under a banner) | Preview (optional) |

## Cron

`vercel.json` schedules `GET /app/api/cron/reminders` every 15 minutes. Vercel adds
`Authorization: Bearer $CRON_SECRET`; anything else gets 401. It sends at most one reminder per
device per day. Check it in Vercel → Project → Cron Jobs (logs show `{checked, sent, removed}`).

## Launch blockers (in order)

1. Eric reviews the movements (Supabase `movements.reviewed_by_eric`) and the app copy in
   `content/app-copy.json` (flip `reviewedByEric`). Until then production shows no movements and no
   starter plan.
2. `/public/board/reference.jpg`: add Eric's board photo, then check the board drawing against it.
3. Supabase production project: migrations + `seed.sql` (not `seed.test.sql`), auth URLs, magic-link
   template with `token_hash`, SMTP sender.
4. Vercel env vars above; Pro plan for the 15-minute cron; `app.thevaryboard.com` domain.
5. Update the site's privacy policy (thevaryboard.com/privacy) with the paragraph below.
6. On a real iPhone: Add to Home Screen, turn on reminders, receive one, turn it off from Settings.
7. `pnpm content:audit` with `SUPABASE_SERVICE_ROLE_KEY` set passes against production data.

## Paragraph for thevaryboard.com/privacy

> **Vary Board App.** The app creates a random device number on your phone; it is not linked to your
> name, email or phone number. Your name, appointment, notes and settings stay on your phone. If you
> use a code from your therapist, the app sends that code, which exercises you did, skipped or made
> easier and when, and whether movement felt easier, the same or harder; your therapist sees these for
> their own codes only. If you turn on reminders, your phone's push address, reminder time, time zone
> and chosen days are stored so one reminder a day can be sent; turning reminders off stops them.
> Reminders are never used for marketing. Clinicians sign in with a work email. We count page views
> with Vercel Analytics without program codes. No other trackers.
