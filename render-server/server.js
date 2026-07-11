// Nova Wave One — always-on media-stream server (deploy to Render.com).
//
// Vercel Serverless Functions cannot hold a WebSocket connection open for the duration of a
// phone call, so the real-time Twilio <-> Deepgram <-> Claude <-> ElevenLabs pipeline lives
// here instead. api/nova-voice/incoming-call.js (in the main Vercel deployment) points Twilio's
// <Connect><Stream> at this service's RENDER_STREAM_URL/stream.

import 'dotenv/config'
import express from 'express'
import { WebSocketServer } from 'ws'
import { createClient as createDeepgramClient } from '@deepgram/sdk'
import fetch from 'node-fetch'
import http from 'http'

const PORT = process.env.PORT || 3000
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() })
})

// Triggers an outbound call and connects it to this same media-stream pipeline.
app.post('/outbound-call', async (req, res) => {
  const { to, agent_id } = req.body || {}
  if (!to || !agent_id) return res.status(400).json({ error: 'to and agent_id are required' })
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return res.status(500).json({ error: 'Twilio not configured' })

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
    const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`
    const streamUrl = `${publicUrl.replace(/^http/, 'ws')}/stream?agent_id=${encodeURIComponent(agent_id)}`
    const twiml = `<Response><Connect><Stream url="${streamUrl}"><Parameter name="agent_id" value="${agent_id}"/></Stream></Connect></Response>`

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_PHONE_NUMBER, Twiml: twiml }).toString(),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data?.message || `Twilio ${r.status}`)
    res.status(200).json({ ok: true, call_sid: data.sid })
  } catch (err) {
    console.error('[outbound-call] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

async function loadAgentAndKnowledgeBase(agentId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return { agent: null, kb: null }
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  const [agentRes, kbRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/nova_ai_agents?id=eq.${agentId}&limit=1`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/nova_ai_knowledge_bases?agent_id=eq.${agentId}&limit=1`, { headers }),
  ])
  const agent = agentRes.ok ? (await agentRes.json())[0] : null
  const kb = kbRes.ok ? (await kbRes.json())[0] : null
  return { agent, kb }
}

function buildSystemPrompt(agent, kb) {
  if (!kb) return `You are a helpful virtual assistant for ${agent?.business_name || 'this business'}. Keep responses to 1-2 short sentences.`
  const faqLines = Array.isArray(kb.faqs) ? kb.faqs.filter((f) => f?.q).map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n') : ''
  return [
    `You are ${agent.agent_name}, a virtual assistant for ${kb.business_name || agent.business_name}.`,
    kb.business_description ? `About the business: ${kb.business_description}` : '',
    kb.services ? `Services and pricing:\n${kb.services}` : '',
    kb.hours ? `Hours: ${kb.hours}` : '',
    faqLines ? `FAQs:\n${faqLines}` : '',
    'You are on a live phone call. Keep every response to 1-2 short, natural sentences.',
  ].filter(Boolean).join('\n')
}

async function askClaude(systemPrompt, history, userText) {
  if (!ANTHROPIC_API_KEY) return "I'm sorry, I'm having trouble connecting right now."
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      temperature: 0.3,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: userText }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content?.[0]?.text || ''
}

async function synthesizeSpeech(text, voiceId) {
  if (!ELEVENLABS_API_KEY || !voiceId) return null
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=ulaw_8000`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/basic' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  })
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.toString('base64')
}

// Both make_call (outbound) and incoming-call.js (inbound) already insert a "pending" row for
// this call in nova_ai_calls, keyed by call_sid, before the media stream ever connects — so this
// updates that existing row instead of inserting a duplicate. Falls back to inserting only if no
// matching row is found (e.g. Twilio's <Start> event fired without the Vercel-side insert having
// completed first, which can happen under load).
async function logCall({ callSid, agentId, callerPhone, transcript, duration, outcome }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
  try {
    if (callSid) {
      const existing = await fetch(`${SUPABASE_URL}/rest/v1/nova_ai_calls?call_sid=eq.${encodeURIComponent(callSid)}&select=id`, { headers })
      const rows = existing.ok ? await existing.json() : []
      if (rows[0]) {
        await fetch(`${SUPABASE_URL}/rest/v1/nova_ai_calls?id=eq.${rows[0].id}`, {
          method: 'PATCH', headers, body: JSON.stringify({ transcript, duration, outcome }),
        })
        return
      }
    }
    await fetch(`${SUPABASE_URL}/rest/v1/nova_ai_calls`, {
      method: 'POST', headers,
      body: JSON.stringify({ agent_id: agentId, caller_phone: callerPhone, call_sid: callSid || null, transcript, duration, outcome, direction: 'inbound' }),
    })
  } catch (err) {
    console.error('[logCall] Error:', err.message)
  }
}

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/stream' })

wss.on('connection', async (twilioWs, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const agentId = url.searchParams.get('agent_id')
  console.log('[stream] Connection opened for agent', agentId)

  let streamSid = null
  let callSid = null
  let callerPhone = null
  let agent = null, kb = null, systemPrompt = ''
  const history = []
  const transcriptLog = []
  let aiSpeaking = false
  const startTime = Date.now()

  if (agentId) {
    try {
      const loaded = await loadAgentAndKnowledgeBase(agentId)
      agent = loaded.agent
      kb = loaded.kb
      systemPrompt = buildSystemPrompt(agent, kb)
    } catch (err) {
      console.error('[stream] Failed to load agent/knowledge base:', err.message)
    }
  }

  let deepgramSocket = null
  if (DEEPGRAM_API_KEY) {
    const deepgram = createDeepgramClient(DEEPGRAM_API_KEY)
    deepgramSocket = deepgram.listen.live({
      encoding: 'mulaw', sample_rate: 8000, channels: 1, punctuate: true, smart_format: true, interim_results: true, model: 'nova-2', language: 'en-US',
    })

    deepgramSocket.on('transcript', async (msg) => {
      const alt = msg?.channel?.alternatives?.[0]
      if (!alt?.transcript) return

      if (!msg.is_final) {
        if (aiSpeaking) {
          // Caller started talking while the AI was speaking — stop and listen (barge-in).
          aiSpeaking = false
          twilioWs.send(JSON.stringify({ event: 'clear', streamSid }))
        }
        return
      }

      const userText = alt.transcript
      transcriptLog.push(`Caller: ${userText}`)
      try {
        aiSpeaking = true
        const replyText = await askClaude(systemPrompt, history, userText)
        history.push({ role: 'user', content: userText }, { role: 'assistant', content: replyText })
        transcriptLog.push(`Agent: ${replyText}`)

        const audioBase64 = await synthesizeSpeech(replyText, agent?.voice_id)
        if (audioBase64 && streamSid) {
          twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: audioBase64 } }))
        }
      } catch (err) {
        console.error('[stream] Turn failed:', err.message)
      } finally {
        aiSpeaking = false
      }
    })

    deepgramSocket.on('error', (err) => console.error('[stream] Deepgram error:', err))
  }

  let loggedFinal = false
  twilioWs.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.event === 'start') {
      streamSid = msg.start?.streamSid
      callSid = msg.start?.callSid || null
      callerPhone = msg.start?.customParameters?.caller_phone || null
    } else if (msg.event === 'media' && deepgramSocket) {
      deepgramSocket.send(Buffer.from(msg.media.payload, 'base64'))
    } else if (msg.event === 'stop') {
      const duration = Math.round((Date.now() - startTime) / 1000)
      loggedFinal = true
      logCall({ callSid, agentId, callerPhone, transcript: transcriptLog.join('\n'), duration, outcome: 'completed' })
      deepgramSocket?.finish()
    }
  })

  twilioWs.on('close', () => {
    console.log('[stream] Connection closed for agent', agentId)
    deepgramSocket?.finish()
    // Twilio's 'stop' event doesn't always arrive before the socket closes (e.g. abrupt hangup)
    // — finalize the call record here too so it never gets stuck at outcome "pending".
    if (!loggedFinal) {
      const duration = Math.round((Date.now() - startTime) / 1000)
      logCall({ callSid, agentId, callerPhone, transcript: transcriptLog.join('\n'), duration, outcome: 'completed' })
    }
  })
})

server.listen(PORT, () => {
  console.log(`Nova Wave One stream server listening on :${PORT}`)
})
