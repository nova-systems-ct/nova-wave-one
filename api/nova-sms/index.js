import { setCors } from '../_cors.js'
import { sanitize, sanitizePhone } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'

async function handleGetConversations(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_sms_logs?order=created_at.desc&limit=200')
  const rows = r.ok ? await r.json() : []
  const threads = {}
  for (const row of rows) {
    const key = row.contact_phone
    if (!threads[key]) threads[key] = { contact_phone: key, sent: 0, received: 0, last_message_at: row.created_at }
    if (row.direction === 'outbound') threads[key].sent++
    else threads[key].received++
  }
  return res.status(200).json(Object.values(threads))
}

async function handleSend(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const to = sanitizePhone(b.to)
  const message = sanitize(b.message, 1600)
  if (!to || !message) return res.status(400).json({ error: 'to and message are required' })
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return res.status(500).json({ error: 'Twilio not configured' })

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: message }).toString(),
    })
    if (!r.ok) throw new Error(`Twilio ${r.status}`)
    if (isSupabaseConfigured()) {
      await supabaseFetch('nova_ai_sms_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ contact_phone: to, direction: 'outbound', message }) }).catch(() => {})
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Send failed' })
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''
  switch (action) {
    case 'get_conversations': return handleGetConversations(req, res)
    case 'send':              return handleSend(req, res)
    default:
      if (req.method === 'GET' && !action) return handleGetConversations(req, res)
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
