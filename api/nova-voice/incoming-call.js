import { validateTwilioSignature, escapeXml, twiml } from './_twilio.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'

// Twilio voice webhook — see render-server/server.js for why the <Connect><Stream> target
// must point at the separately-hosted always-on WebSocket service, not this Vercel deployment.
export default async function handler(req, res) {
  logEnvCheck('Nova Voice — incoming-call', ['TWILIO_AUTH_TOKEN', 'RENDER_STREAM_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  try {
    return await handleIncomingCall(req, res)
  } catch (err) {
    console.error('[Nova Voice — incoming-call] Unhandled error:', err)
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/xml')
      return res.status(200).send(twiml('<Say voice="Polly.Joanna">Sorry, something went wrong. Please try calling back in a moment.</Say>'))
    }
  }
}

async function handleIncomingCall(req, res) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (authToken) {
    const fullUrl = `https://${req.headers.host}${req.url}`
    if (!validateTwilioSignature(req, authToken, fullUrl)) {
      return res.status(403).send('Invalid signature')
    }
  }

  const calledNumber = req.body?.To || ''
  const callerNumber = req.body?.From || ''
  const callSid = req.body?.CallSid || ''
  res.setHeader('Content-Type', 'text/xml')

  let agent = null
  if (isSupabaseConfigured() && calledNumber) {
    try {
      const r = await supabaseFetch(`nova_ai_agents?phone_number=eq.${encodeURIComponent(calledNumber)}&select=id,agent_name,status&limit=1`)
      if (r.ok) { const rows = await r.json(); agent = rows[0] || null }
    } catch (err) {
      console.error('[nova-voice:incoming-call] Agent lookup failed:', err.message)
    }
  }

  // Log the inbound call up front so it shows up in Call Logs even if it never gets past
  // this webhook (voicemail, no agent, stream server down) — call_completed fills in the
  // final outcome/duration/recording once Twilio's status callback fires.
  if (isSupabaseConfigured() && callSid) {
    await supabaseFetch('nova_ai_calls', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ agent_id: agent?.id || null, caller_phone: callerNumber, call_sid: callSid, direction: 'inbound', outcome: 'pending' }),
    }).catch((err) => console.error('[nova-voice:incoming-call] Inbound call log failed (non-fatal):', err.message))
  }

  if (!agent || agent.status === 'inactive') {
    return res.status(200).send(twiml(
      '<Say voice="Polly.Joanna">Thank you for calling Nova Systems. Please leave a message after the tone and we will call you back within the hour.</Say>' +
      '<Record maxLength="120" transcribe="false" />'
    ))
  }

  const streamBase = process.env.RENDER_STREAM_URL || ''
  if (!streamBase) {
    return res.status(200).send(twiml(
      '<Say voice="Polly.Joanna">This system is still being configured. Please leave a message after the tone and we will call you back.</Say>' +
      '<Record maxLength="120" transcribe="false" />'
    ))
  }

  const streamUrl = `${streamBase.replace(/^http/, 'ws')}/stream?agent_id=${encodeURIComponent(agent.id)}`
  return res.status(200).send(twiml(
    `<Connect><Stream url="${escapeXml(streamUrl)}"><Parameter name="agent_id" value="${escapeXml(agent.id)}" /></Stream></Connect>`
  ))
}
