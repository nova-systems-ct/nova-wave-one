import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { loadAgentById } from '../_agents.js'
import { alertIsaac, reportEngineError } from '../_automation.js'

function toE164(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`
}

function escapeXml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

const FALLBACK_SCRIPTS = {
  appointment_reminder: (agentName, businessName, phone) =>
    `Hi this is ${agentName} calling from ${businessName}. I am calling to remind you about your upcoming appointment. Please call us back at ${phone} if you need to reschedule. Thank you and have a great day.`,
  follow_up: (agentName, businessName, phone) =>
    `Hi this is ${agentName} from ${businessName}. I am following up to see if you had any questions. Please give us a call back at ${phone}. Thank you.`,
  cold_outreach: (agentName, _businessName, phone) =>
    `Hi my name is ${agentName} calling from Nova Systems in Waterbury Connecticut. We recently completed a free business audit for your company and found some interesting insights. I would love to share them with you. Please call us back at ${phone}. Thank you.`,
  reactivation: (agentName, businessName, phone) =>
    `Hi this is ${agentName} from ${businessName}. It has been a while since we connected and I wanted to check in. Give us a call back at ${phone} when you get a chance. Thank you.`,
}

async function createCallStatusCallback() {
  // Vercel deployments don't know their own public URL from inside a function reliably; use the
  // documented production domain, falling back to VERCEL_URL when set by the platform.
  const base = process.env.PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://nova-wave-one.vercel.app')
  return `${base}/api/nova-voice?action=call_completed`
}

// ============================================================ ACTION: make_call ============

async function handleMakeCall(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const rawTo = b.to
  const agent_id = sanitize(b.agent_id, 100)
  const call_purpose = ['appointment_reminder', 'follow_up', 'cold_outreach', 'reactivation'].includes(b.call_purpose) ? b.call_purpose : 'follow_up'

  const to = toE164(rawTo)
  if (!to) return res.status(400).json({ error: 'A valid 10-digit US phone number is required for "to"' })
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' })

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return res.status(500).json({ error: 'Twilio is not configured' })

  const agent = await loadAgentById(agent_id)
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  let callTwiml
  const streamBase = process.env.RENDER_STREAM_URL || ''
  if (streamBase) {
    const streamUrl = `${streamBase.replace(/^http/, 'ws')}/stream?agent_id=${encodeURIComponent(agent_id)}`
    callTwiml = twiml(`<Connect><Stream url="${escapeXml(streamUrl)}"><Parameter name="agent_id" value="${escapeXml(agent_id)}" /><Parameter name="call_purpose" value="${escapeXml(call_purpose)}" /></Stream></Connect>`)
  } else {
    const script = (FALLBACK_SCRIPTS[call_purpose] || FALLBACK_SCRIPTS.follow_up)(agent.agent_name || 'Nova', agent.business_name || 'our business', TWILIO_PHONE_NUMBER)
    callTwiml = twiml(`<Say voice="Polly.Joanna">${escapeXml(script)}</Say>`)
  }

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
    const statusCallback = await createCallStatusCallback()
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        To: to, From: TWILIO_PHONE_NUMBER, Twiml: callTwiml,
        StatusCallback: statusCallback, StatusCallbackEvent: 'completed', Timeout: '30',
      }).toString(),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data?.message || `Twilio ${r.status}`)

    if (isSupabaseConfigured()) {
      await supabaseFetch('nova_ai_calls', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ agent_id, caller_phone: to, call_sid: data.sid, direction: 'outbound', outcome: 'pending' }),
      }).catch((err) => console.error('[nova-voice:make_call] Log failed (non-fatal):', err.message))
    }

    return res.status(200).json({ call_sid: data.sid, status: data.status, agent_name: agent.agent_name })
  } catch (err) {
    await reportEngineError('Nova Voice', 'make_call', to, err)
    return res.status(500).json({ error: err.message || 'Call failed' })
  }
}

// ============================================================ ACTION: call_completed =======
// Twilio status callback — configured automatically by make_call via StatusCallback. Also wire
// this same URL as the "Call status changes" webhook on the Nova Systems inbound number in the
// Twilio Console for inbound-call outcome tracking.

async function handleCallCompleted(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')
  const b = req.body || {}
  const CallSid = sanitize(b.CallSid, 100)
  const CallStatus = sanitize(b.CallStatus, 30)
  const CallDuration = parseInt(b.CallDuration, 10) || 0
  const RecordingUrl = sanitize(b.RecordingUrl, 500)

  if (!CallSid || !isSupabaseConfigured()) return res.status(200).send('ok')

  try {
    const r = await supabaseFetch(`nova_ai_calls?call_sid=eq.${encodeURIComponent(CallSid)}&limit=1`)
    const rows = r.ok ? await r.json() : []
    const call = rows[0]

    const patch = { outcome: CallStatus, duration: CallDuration }
    if (RecordingUrl) patch.recording_url = RecordingUrl

    if (call) {
      await supabaseFetch(`nova_ai_calls?id=eq.${call.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
    } else {
      await supabaseFetch(`nova_ai_calls?call_sid=eq.${encodeURIComponent(CallSid)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) }).catch(() => {})
    }

    if (['no-answer', 'busy', 'failed'].includes(CallStatus)) {
      const phone = call?.caller_phone || 'a caller'
      await alertIsaac(`Missed call alert: ${phone} did not answer the Nova AI call. Consider following up via SMS.`).catch(() => {})
    }
  } catch (err) {
    console.error('[nova-voice:call_completed] Failed:', err.message)
  }

  return res.status(200).send('ok')
}

// ============================================================ ACTION: send_voicemail_summary

async function handleSendVoicemailSummary(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const phone = sanitize(b.phone, 40)
  if (!phone) return res.status(400).json({ error: 'phone is required' })
  const result = await alertIsaac(`Missed call from ${phone} on Nova AI line. Check your dashboard to follow up.`)
  return res.status(200).json({ ok: result.ok })
}

// ============================================================ ACTION: get_calls =============

async function handleGetCalls(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const q = req.query || {}
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 100))
  const offset = (page - 1) * limit
  const filters = []
  if (q.direction) filters.push(`direction=eq.${encodeURIComponent(q.direction)}`)
  if (q.outcome) filters.push(`outcome=eq.${encodeURIComponent(q.outcome)}`)
  if (q.agent_id) filters.push(`agent_id=eq.${encodeURIComponent(q.agent_id)}`)
  const query = filters.length ? `&${filters.join('&')}` : ''
  const r = await supabaseFetch(`nova_ai_calls?order=created_at.desc&limit=${limit}&offset=${offset}${query}`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: render_status ========
// Server-side health ping so the Render stream server URL (a private env var) never has to be
// exposed to the browser just to show a connected/not-connected indicator.

async function handleRenderStatus(req, res) {
  const base = process.env.RENDER_STREAM_URL || ''
  if (!base) return res.status(200).json({ configured: false, connected: false })
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(5000) })
    return res.status(200).json({ configured: true, connected: r.ok })
  } catch (err) {
    return res.status(200).json({ configured: true, connected: false, error: err.message })
  }
}

// ============================================================ existing agent/voice actions ==

async function handleGetAgents(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_agents?order=created_at.desc')
  return res.status(200).json(r.ok ? await r.json() : [])
}

async function handleGetAgent(req, res) {
  const id = sanitize(req.query?.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isSupabaseConfigured()) return res.status(404).json(null)
  const r = await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(id)}&limit=1`)
  const rows = r.ok ? await r.json() : []
  return res.status(200).json(rows[0] || null)
}

async function handleCreateAgent(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const agent_name = sanitize(b.agent_name, 100) || 'Nova'
  const business_name = sanitize(b.business_name, 200)
  if (!business_name) return res.status(400).json({ error: 'business_name is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch('nova_ai_agents', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ agent_name, business_name, status: 'testing' }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to create agent' })
  const rows = await r.json()
  return res.status(200).json({ ok: true, agent: rows[0] })
}

async function handleGetVoices(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_voices?order=created_at.asc')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ================================================================================= router ==

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''

  switch (action) {
    case 'make_call':                return handleMakeCall(req, res)
    case 'call_completed':           return handleCallCompleted(req, res)
    case 'send_voicemail_summary':   return handleSendVoicemailSummary(req, res)
    case 'get_calls':                return handleGetCalls(req, res)
    case 'render_status':            return handleRenderStatus(req, res)
    case 'get_agents':               return handleGetAgents(req, res)
    case 'get_agent':                return handleGetAgent(req, res)
    case 'create_agent':             return handleCreateAgent(req, res)
    case 'get_voices':                return handleGetVoices(req, res)
    default:
      if (req.method === 'GET' && !action) return handleGetAgents(req, res)
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
