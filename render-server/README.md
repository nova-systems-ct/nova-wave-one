# Nova Wave One — Stream Server

Always-on WebSocket server that handles real-time phone call audio for Nova Voice.
This must run somewhere that can hold a connection open for the duration of a call —
Vercel Serverless Functions cannot do this, which is why it's deployed separately.

## Deploying to Render.com

1. Push this repo to GitHub (already done as part of `nova-wave-one`).
2. In the Render dashboard, click **New +** → **Web Service**.
3. Connect the `nova-wave-one` GitHub repo.
4. Set **Root Directory** to `render-server`.
5. Set **Build Command** to `npm install`.
6. Set **Start Command** to `node server.js` (or leave blank — the `Procfile` covers it).
7. Set **Health Check Path** to `/health`.
8. Set **Plan** to **Starter** ($7/month) — this needs to stay always-on; the free tier spins down between requests, which breaks live calls.
9. Add these environment variables (same values as the main Vercel project's `.env.local`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `DEEPGRAM_API_KEY`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
10. Deploy. Render will give you a public URL like `https://nova-wave-stream.onrender.com`.
11. Back in the main Vercel project, set `RENDER_STREAM_URL` to that URL (e.g. `https://nova-wave-stream.onrender.com`) and redeploy — `api/nova-voice/incoming-call.js` uses it to build the Twilio `<Stream>` target.

## Local development

```bash
cd render-server
npm install
cp .env.example .env   # fill in the same keys as above
npm start
```

`GET /health` should return `{"status":"ok","uptime":...}`.
