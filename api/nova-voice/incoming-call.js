import { validateTwilioSignature, escapeXml, twiml } from './_twilio.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'

// Twilio voice webhook — see render-server/server.js for why the <Connect><Stream> target
// must point at the separately-hosted always-on WebSocket service, not this Vercel deployment.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (authToken) {
    const fullUrl = `https://${req.headers.host}${req.url}`
    if (!validateTwilioSignature(req, authToken, fullUrl)) {
      return res.status(403).send('Invalid signature')
    }
  }

  const calledNumber = req.body?.To || ''
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

  if (!agent || agent.status === 'inactive') {
    return res.status(200).send(twiml('<Say voice="Polly.Joanna">This number is not currently active. Please try again later.</Say>'))
  }

  const streamBase = process.env.RENDER_STREAM_URL || ''
  if (!streamBase) {
    return res.status(200).send(twiml('<Say voice="Polly.Joanna">This system is still being configured. Please try again soon.</Say>'))
  }

  const streamUrl = `${streamBase.replace(/^http/, 'ws')}/stream?agent_id=${encodeURIComponent(agent.id)}`
  return res.status(200).send(twiml(
    `<Connect><Stream url="${escapeXml(streamUrl)}"><Parameter name="agent_id" value="${escapeXml(agent.id)}" /></Stream></Connect>`
  ))
}
