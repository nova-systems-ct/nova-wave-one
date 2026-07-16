# Nova Wave One

Business intelligence and AI outreach platform for Nova Systems. Deployed separately from
`nova-systems-copy` (nova-systems.app) — this app is meant for `nova-systems.agency`.

## Stack

- **Frontend:** React + Vite + TailwindCSS + React Router
- **Backend:** Vercel Serverless Functions (`/api`)
- **Database:** Same Supabase project as nova-systems.app (`xizmgruvuazmummotzkp`)
- **Hosting:** Vercel
- **Stream server:** Render.com — always-on Node process for real-time phone call audio (see `render-server/README.md`)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values — see nova-systems-copy/.env.local for shared keys
npm run dev
```

## What's real vs. what needs setup

- **Nova Audit** is fully implemented: Google PageSpeed scan, Google Places business lookup,
  Claude-based competitor discovery, revenue-leak math, a 7-page PDF (jsPDF) and 8-slide pitch
  deck (PptxGenJS), delivery via Resend/Twilio, and the dashboard UI (form, loading steps,
  result page, reports table, bulk scan).
- **Phone and email response testing** place a real test call / send a real test email, but
  cannot score "rings before answer" or "replied within 24h" synchronously in one request —
  Twilio doesn't return ring/voicemail data from its REST API, and a real reply can take hours.
  Both are reported as "test placed" rather than fabricated scores. Wiring up a status-callback
  webhook and a scheduled reply-check job would close this gap.
- **Nova Voice** (phone agent) backend is built against `nova_ai_agents` /
  `nova_ai_knowledge_bases`, but the real-time audio loop only runs once `render-server/` is
  deployed to Render and `RENDER_STREAM_URL` is set.
- **Nova Social** has no working integration yet — Instagram/Facebook/TikTok/LinkedIn DM
  automation requires each platform's OAuth-based Business API and a connected account; there's
  no free, ToS-compliant way to read follower counts or send DMs for a third party without one.
  The audit's "social score" is reported as unavailable rather than guessed.
- **Nova SMS, Nova Email, Nova Revive** have working backend routes and dashboard pages at a
  functional-but-lean depth — enough to send/log/list, not a full campaign engine yet.
- **This Vercel project is currently on the Hobby plan**, which only allows crons that run once a
  day or less — a deploy with a more-frequent cron fails outright (`deploy_failed`, no partial
  deploy, no fallback). Discovered 2026-07-16 when production had been silently stuck on an old
  commit for a while because every subsequent deploy with a sub-daily cron failed. Nova Tron's
  trend analysis, Nova Social's scheduled-post publishing, Nova Reviews' review polling, and Nova
  Flow's delayed-workflow-step queue are all throttled to once/day in `vercel.json` as a result —
  intended to run every 6h/15min/hourly/15min respectively. Upgrading to Vercel Pro removes this
  cap (and the function-count cap — this project has ~24 real endpoint files, over Hobby's limit)
  and the schedules in `vercel.json` should be restored to their intended frequency at that point.

## Deploying

1. Push to GitHub, import into Vercel, set all variables from `.env.example` in the Vercel
   project settings (Production + Preview).
2. Deploy `render-server/` to Render.com separately — see `render-server/README.md`.
3. Set `RENDER_STREAM_URL` in Vercel to the Render service's URL once it's live.
4. Run `supabase/schema.sql` in the Supabase SQL Editor (the shared `nova_ai_*` tables already
   exist from nova-systems-copy — this file only adds what's new for Wave One).

## Connecting the nova-systems.agency domain

Once deployed on Vercel: go to the Vercel project's **Settings → Domains**, add
`nova-systems.agency`, then in GoDaddy's DNS settings add the CNAME/A records Vercel provides
on that page.
