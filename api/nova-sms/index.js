// Nova Blue (SMS) + Nova WhatsApp — both ride Twilio's Messaging API, so they share one file.
// See the note at the bottom of this file for how to point a Twilio number's webhook here.
import { setCors } from '../_cors.js'
import { sanitize, sanitizePhone } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { validateTwilioSignature, escapeXml } from '../nova-voice/_twilio.js'
import { loadAgentByPhone, loadKnowledgeBase, buildSystemPrompt, callClaude } from '../_agents.js'
import {
  isStopMessage, isOptedOut, optOutContact, underDailyRateLimit,
  passesContentFilter, alertHotLeadReply, reportEngineError, personalize,
} from '../_automation.js'
import { logEnvCheck } from '../_envCheck.js'

const SMS_CHANNEL_INSTRUCTIONS = 'You are texting with someone over SMS. Always be helpful, friendly, and concise. Keep replies under 160 characters when possible.'
const WHATSAPP_CHANNEL_INSTRUCTIONS = 'You are messaging with someone over WhatsApp. Always be helpful, friendly, and concise. Keep replies under 200 characters when possible.'

function messagingTwiml(text) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(text)}</Message></Response>`
}

function toWhatsApp(number) {
  const digits = String(number || '').replace(/[^0-9]/g, '')
  if (!digits) return ''
  const withCountry = digits.length === 10 ? `1${digits}` : digits
  return `whatsapp:+${withCountry}`
}

function stripWhatsAppPrefix(number) {
  return String(number || '').replace(/^whatsapp:/i, '')
}

async function sendTwilioMessage({ to, from, body }) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error('Twilio credentials are not configured')
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `Twilio ${r.status}`)
  return data
}

async function logMessage({ agent_id, contact_phone, direction, message, message_sid, platform }) {
  if (!isSupabaseConfigured()) return
  try {
    await supabaseFetch('nova_ai_sms_logs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ agent_id: agent_id || null, contact_phone, direction, message, message_sid: message_sid || null, platform: platform || 'sms' }),
    })
  } catch (err) {
    console.error('[nova-sms:logMessage] Failed:', err.message)
  }
}

// ============================================================ ACTION: send_sms ============

async function handleSendSms(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const to = sanitizePhone(b.to)
  const message = sanitize(b.message, 1600)
  const agent_id = sanitize(b.agent_id, 100) || null
  if (!to || !message) return res.status(400).json({ error: 'to and message are required' })

  if (await isOptedOut(to)) return res.status(403).json({ success: false, error: 'This contact has opted out and cannot be messaged.' })

  const { TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_PHONE_NUMBER) return res.status(500).json({ success: false, error: 'TWILIO_PHONE_NUMBER is not configured' })

  try {
    const data = await sendTwilioMessage({ to, from: TWILIO_PHONE_NUMBER, body: message })
    await logMessage({ agent_id, contact_phone: to, direction: 'outbound', message, message_sid: data.sid, platform: 'sms' })
    return res.status(200).json({ success: true, message_sid: data.sid, to })
  } catch (err) {
    await reportEngineError('Nova Blue SMS', 'send_sms', to, err)
    return res.status(500).json({ success: false, error: err.message || 'Send failed' })
  }
}

// ============================================================ ACTION: receive_sms =========
// Twilio webhook — Phone Numbers -> [number] -> Messaging -> "A message comes in" ->
// https://nova-wave-one.vercel.app/api/nova-sms?action=receive_sms, HTTP POST.

async function handleReceiveInbound(req, res, { whatsapp }) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (authToken) {
    const fullUrl = `https://${req.headers.host}${req.url}`
    if (!validateTwilioSignature(req, authToken, fullUrl)) return res.status(403).send('Invalid signature')
  }

  const rawFrom = sanitize(req.body?.From, 40)
  const rawTo = sanitize(req.body?.To, 40)
  const body = sanitize(req.body?.Body, 1600)
  const contactPhone = whatsapp ? stripWhatsAppPrefix(rawFrom) : sanitizePhone(rawFrom)
  const ourNumber = whatsapp ? stripWhatsAppPrefix(rawTo) : sanitizePhone(rawTo)
  res.setHeader('Content-Type', 'text/xml')

  if (!contactPhone) return res.status(200).send(messagingTwiml('Sorry, we could not process that message.'))

  const agent = await loadAgentByPhone(ourNumber)
  await logMessage({ agent_id: agent?.id, contact_phone: contactPhone, direction: 'inbound', message: body, platform: whatsapp ? 'whatsapp' : 'sms' })

  // STOP / opt-out — highest priority, always honored, no AI reply generated for it.
  if (isStopMessage(body)) {
    await optOutContact(contactPhone, `Replied STOP on ${whatsapp ? 'WhatsApp' : 'SMS'}`)
    const confirm = 'You have been unsubscribed and will not receive further messages. Reply START to opt back in.'
    await logMessage({ agent_id: agent?.id, contact_phone: contactPhone, direction: 'outbound', message: confirm, platform: whatsapp ? 'whatsapp' : 'sms' })
    return res.status(200).send(messagingTwiml(confirm))
  }

  // Any inbound reply pauses outbound sequences for this lead and flags it Warm — alert Isaac.
  await alertHotLeadReply(whatsapp ? 'WhatsApp' : 'SMS', contactPhone)

  if (!agent) {
    const fallback = 'Thank you for texting Nova Systems. We will be in touch shortly. Visit nova-systems.app to book a meeting.'
    await logMessage({ contact_phone: contactPhone, direction: 'outbound', message: fallback, platform: whatsapp ? 'whatsapp' : 'sms' })
    return res.status(200).send(messagingTwiml(fallback))
  }

  const kb = await loadKnowledgeBase(agent.id)
  const systemPrompt = buildSystemPrompt(agent, kb, whatsapp ? WHATSAPP_CHANNEL_INSTRUCTIONS : SMS_CHANNEL_INSTRUCTIONS)
  const reply = await callClaude(systemPrompt, body, { maxTokens: 150, temperature: 0.3 })
  const finalReply = reply || 'Thanks for reaching out — someone from our team will follow up with you shortly.'

  const passed = await passesContentFilter(finalReply, { engine: whatsapp ? 'Nova WhatsApp' : 'Nova Blue SMS', contactLabel: contactPhone })
  const outboundText = passed ? finalReply : 'Thanks for reaching out — someone from our team will follow up with you shortly.'

  await logMessage({ agent_id: agent.id, contact_phone: contactPhone, direction: 'outbound', message: outboundText, platform: whatsapp ? 'whatsapp' : 'sms' })
  return res.status(200).send(messagingTwiml(outboundText))
}

// ============================================================ ACTION: send_campaign =======

async function handleSendCampaign(req, res, { whatsapp }) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const campaign_name = sanitize(b.campaign_name, 200)
  const message_template = sanitize(b.message_template, 1600)
  const recipients = Array.isArray(b.recipients) ? b.recipients : (Array.isArray(b.phone_list) ? b.phone_list : [])
  const agent_id = sanitize(b.agent_id, 100) || null
  if (!message_template || !recipients.length) return res.status(400).json({ error: 'message_template and recipients are required' })

  const { TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_PHONE_NUMBER) return res.status(500).json({ error: 'TWILIO_PHONE_NUMBER is not configured' })

  const campaign_id = `camp_${Date.now().toString(36)}`
  let total_sent = 0
  const failed_numbers = []

  for (const recipient of recipients) {
    const phone = sanitizePhone(recipient.phone)
    if (!phone) { failed_numbers.push(recipient.phone || 'unknown'); continue }
    if (await isOptedOut(phone)) { failed_numbers.push(phone); continue }
    if (!(await underDailyRateLimit({ phone }))) { failed_numbers.push(phone); continue }

    const personalized = personalize(message_template, { name: recipient.name || 'there', business: recipient.business || recipient.business_name || '' })
    const passed = await passesContentFilter(personalized, { engine: 'Nova Blue Campaign', contactLabel: phone })
    if (!passed) { failed_numbers.push(phone); continue }

    try {
      const to = whatsapp ? toWhatsApp(phone) : phone
      const from = whatsapp ? toWhatsApp(TWILIO_PHONE_NUMBER) : TWILIO_PHONE_NUMBER
      const data = await sendTwilioMessage({ to, from, body: personalized })
      await logMessage({ agent_id, contact_phone: phone, direction: 'outbound', message: personalized, message_sid: data.sid, platform: whatsapp ? 'whatsapp' : 'sms' })
      total_sent++
    } catch (err) {
      console.error(`[nova-sms:send_campaign] Failed for ${phone}:`, err.message)
      failed_numbers.push(phone)
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  return res.status(200).json({ ok: true, campaign_id, campaign_name, total_sent, total_failed: failed_numbers.length, failed_numbers })
}

// ============================================================ ACTION: get_conversations ===

async function handleGetConversations(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_sms_logs?order=created_at.desc&limit=500')
  const rows = r.ok ? await r.json() : []
  const threads = {}
  for (const row of rows) {
    const key = row.contact_phone
    if (!key) continue
    if (!threads[key]) threads[key] = { contact_phone: key, platform: row.platform || 'sms', last_message: row.message, last_message_time: row.created_at, total_messages: 0, unread: 0, _sawOutboundSinceInbound: false }
    threads[key].total_messages++
    if (new Date(row.created_at) > new Date(threads[key].last_message_time)) {
      threads[key].last_message = row.message
      threads[key].last_message_time = row.created_at
    }
  }
  // unread = inbound messages that arrived after the most recent outbound message.
  const byContact = {}
  for (const row of rows) {
    if (!row.contact_phone) continue
    if (!byContact[row.contact_phone]) byContact[row.contact_phone] = []
    byContact[row.contact_phone].push(row)
  }
  for (const [phone, msgs] of Object.entries(byContact)) {
    const sorted = msgs.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    let unread = 0
    for (const m of sorted) {
      if (m.direction === 'outbound') break
      unread++
    }
    if (threads[phone]) threads[phone].unread = unread
  }
  const result = Object.values(threads).map(({ _sawOutboundSinceInbound, ...t }) => t)
  result.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time))
  return res.status(200).json(result)
}

async function handleGetConversation(req, res) {
  const contact_phone = sanitize(req.query?.contact_phone || req.query?.phone, 40)
  if (!contact_phone) return res.status(400).json({ error: 'contact_phone is required' })
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch(`nova_ai_sms_logs?contact_phone=eq.${encodeURIComponent(contact_phone)}&order=created_at.asc`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: check_cold_leads ====

async function handleCheckColdLeads(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ ok: true, followed_up: 0 })
  const r = await supabaseFetch('nova_ai_sms_logs?order=created_at.desc&limit=1000')
  const rows = r.ok ? await r.json() : []

  const byContact = {}
  for (const row of rows) {
    if (!row.contact_phone) continue
    if (!byContact[row.contact_phone]) byContact[row.contact_phone] = []
    byContact[row.contact_phone].push(row)
  }

  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000
  let followed_up = 0

  for (const [phone, msgs] of Object.entries(byContact)) {
    const sorted = msgs.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const last = sorted[0]
    if (!last || last.direction !== 'outbound') continue
    if (new Date(last.created_at).getTime() > sixHoursAgo) continue
    if (await isOptedOut(phone)) continue
    if (!(await underDailyRateLimit({ phone }))) continue

    const followUp = 'Hey just checking in — did you get a chance to look at that info? Happy to answer any questions.'
    const { TWILIO_PHONE_NUMBER } = process.env
    if (!TWILIO_PHONE_NUMBER) continue
    try {
      const data = await sendTwilioMessage({ to: phone, from: TWILIO_PHONE_NUMBER, body: followUp })
      await logMessage({ agent_id: last.agent_id, contact_phone: phone, direction: 'outbound', message: followUp, message_sid: data.sid, platform: 'sms' })
      followed_up++
    } catch (err) {
      console.error(`[nova-sms:check_cold_leads] Follow-up failed for ${phone}:`, err.message)
    }
  }

  return res.status(200).json({ ok: true, followed_up })
}

// ============================================================ ACTION: send_whatsapp =======

async function handleSendWhatsapp(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const to = sanitizePhone(b.to)
  const message = sanitize(b.message, 1600)
  const agent_id = sanitize(b.agent_id, 100) || null
  if (!to || !message) return res.status(400).json({ error: 'to and message are required' })
  if (await isOptedOut(to)) return res.status(403).json({ success: false, error: 'This contact has opted out and cannot be messaged.' })

  const { TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_PHONE_NUMBER) return res.status(500).json({ success: false, error: 'TWILIO_PHONE_NUMBER is not configured' })

  try {
    const data = await sendTwilioMessage({ to: toWhatsApp(to), from: toWhatsApp(TWILIO_PHONE_NUMBER), body: message })
    await logMessage({ agent_id, contact_phone: to, direction: 'outbound', message, message_sid: data.sid, platform: 'whatsapp' })
    return res.status(200).json({ success: true, message_sid: data.sid })
  } catch (err) {
    await reportEngineError('Nova WhatsApp', 'send_whatsapp', to, err)
    return res.status(500).json({ success: false, error: err.message || 'Send failed' })
  }
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Blue SMS', ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'send_sms':              return await handleSendSms(req, res)
      case 'receive_sms':           return await handleReceiveInbound(req, res, { whatsapp: false })
      case 'send_campaign':         return await handleSendCampaign(req, res, { whatsapp: false })
      case 'get_conversations':     return await handleGetConversations(req, res)
      case 'get_conversation':      return await handleGetConversation(req, res)
      case 'check_cold_leads':      return await handleCheckColdLeads(req, res)
      case 'send_whatsapp':         return await handleSendWhatsapp(req, res)
      case 'receive_whatsapp':      return await handleReceiveInbound(req, res, { whatsapp: true })
      case 'send_whatsapp_campaign': return await handleSendCampaign(req, res, { whatsapp: true })
      // Back-compat with the earlier stub's action name.
      case 'send':                  return await handleSendSms(req, res)
      default:
        if (req.method === 'GET' && !action) return await handleGetConversations(req, res)
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Blue SMS] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}

// Twilio webhook configuration:
// SMS    — Twilio Console -> Phone Numbers -> your Nova Systems number -> Messaging -> "A message
//          comes in" -> https://nova-wave-one.vercel.app/api/nova-sms?action=receive_sms, HTTP POST.
// WhatsApp — Twilio Console -> Messaging -> Try it out / Senders -> your WhatsApp sender ->
//          "When a message comes in" -> https://nova-wave-one.vercel.app/api/nova-sms?action=receive_whatsapp, HTTP POST.
