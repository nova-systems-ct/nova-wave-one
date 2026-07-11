import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { loadAgentById, loadKnowledgeBase, buildSystemPrompt, callClaude } from '../_agents.js'
import {
  isStopMessage, isOptedOut, optOutContact, underDailyRateLimit,
  passesContentFilter, isLowConfidence, alertIsaac, alertHotLeadReply, reportEngineError, personalize,
} from '../_automation.js'

const CATEGORIES = ['Important', 'Client', 'Lead', 'Spam', 'Automated']
const FROM_ADDRESS = 'hello@nova-systems.app'

function unsubscribeFooter(email) {
  return `<p style="color:#999;font-size:12px;margin-top:40px;">To unsubscribe reply with STOP or <a href="https://nova-systems.app/unsubscribe?email=${encodeURIComponent(email || '')}">click here</a>. Nova Systems, Waterbury CT.</p>`
}

async function sendViaResend({ to, subject, html, from_name }) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${from_name || 'Nova Systems'} <${FROM_ADDRESS}>`, to: [to], subject, html }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `Resend ${r.status}`)
  return data
}

async function logEmail(fields) {
  if (!isSupabaseConfigured()) return
  try {
    await supabaseFetch('nova_ai_email_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fields) })
  } catch (err) {
    console.error('[nova-email:logEmail] Failed:', err.message)
  }
}

// Naive category-based scoring heuristic used when generate_reply needs a confidence number —
// mirrors the spec's fixed buckets rather than asking Claude to self-report confidence (which is
// notoriously unreliable coming from the model itself).
function estimateConfidence(text) {
  const t = String(text || '').toLowerCase()
  if (/\b(price|pricing|cost|quote|how much)\b/.test(t)) return 60
  if (/\b(complain|complaint|refund|angry|upset|unhappy|disappointed)\b/.test(t)) return 55
  if (/\b(meet|meeting|schedule|call|appointment|book)\b/.test(t)) return 85
  if (/\?/.test(t) && t.split(' ').length < 40) return 90
  return 75
}

// ============================================================ ACTION: send_email ==========

async function handleSendEmail(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const to = sanitizeEmail(b.to)
  const subject = sanitize(b.subject, 300)
  const body_html = sanitize(b.body_html || b.html, 20000)
  const body_text = sanitize(b.body_text || b.text, 8000)
  const from_name = sanitize(b.from_name, 100) || 'Nova Systems'
  if (!to || !subject || (!body_html && !body_text)) return res.status(400).json({ success: false, error: 'to, subject, and body_html or body_text are required' })
  if (await isOptedOut(to)) return res.status(403).json({ success: false, error: 'This contact has opted out and cannot be emailed.' })

  const html = body_html || `<p>${body_text}</p>`

  try {
    const data = await sendViaResend({ to, subject, html, from_name })
    await logEmail({ direction: 'outbound', from_email: FROM_ADDRESS, to_email: to, subject, body: html, sent: true })
    return res.status(200).json({ success: true, email_id: data.id })
  } catch (err) {
    await reportEngineError('Nova Email', 'send_email', to, err)
    return res.status(500).json({ success: false, error: err.message || 'Send failed' })
  }
}

// ============================================================ ACTION: send_campaign =======

async function handleSendCampaign(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const campaign_name = sanitize(b.campaign_name, 200)
  const subject_template = sanitize(b.subject_template || b.subject, 300)
  const html_template = sanitize(b.body_html_template || b.html_template || b.body, 20000)
  const sequence_day = [1, 3, 7, 14].includes(Number(b.sequence_day)) ? Number(b.sequence_day) : 1
  let recipients = Array.isArray(b.recipient_list) ? b.recipient_list : (Array.isArray(b.recipients) ? b.recipients : null)

  if (!subject_template || !html_template) return res.status(400).json({ error: 'subject_template and body_html_template are required' })

  // No explicit recipient list — pull real pending leads with an email on file from the audit
  // pipeline (Nova Audit -> Nova Email cross-engine trigger).
  if (!recipients) {
    if (!isSupabaseConfigured()) return res.status(200).json({ ok: true, total_sent: 0, total_failed: 0, note: 'Supabase not configured — nothing to send to.' })
    const r = await supabaseFetch("nova_ai_audits?opted_out=eq.false&email=not.is.null&became_client=eq.false&select=id,business_name,owner_name,email,city,industry,overall_score,revenue_leak_monthly,competitor_data")
    const leads = r.ok ? await r.json() : []
    recipients = leads.map((l) => ({
      email: l.email, name: l.owner_name || l.business_name, business_name: l.business_name,
      city: l.city, industry: l.industry, score: l.overall_score, monthly_leak: l.revenue_leak_monthly,
      competitor_name: l.competitor_data?.[0]?.name, _audit_id: l.id,
    }))
  }

  let total_sent = 0
  const failedRecipients = []

  for (const recipient of recipients) {
    const email = sanitizeEmail(recipient.email)
    if (!email) { failedRecipients.push(recipient.email || 'unknown'); continue }
    if (await isOptedOut(email)) { failedRecipients.push(email); continue }
    if (!(await underDailyRateLimit({ email }))) { failedRecipients.push(email); continue }

    const tokens = {
      name: recipient.name || 'there',
      business_name: recipient.business_name || '',
      city: recipient.city || '',
      industry: recipient.industry || '',
      score: recipient.score ?? '',
      monthly_leak: recipient.monthly_leak != null ? `$${Number(recipient.monthly_leak).toLocaleString()}` : '',
      competitor_name: recipient.competitor_name || 'a competitor',
    }
    const subject = personalize(subject_template, tokens)
    const html = personalize(html_template, tokens) + unsubscribeFooter(email)

    const passed = await passesContentFilter(html, { engine: 'Nova Email Campaign', contactLabel: email })
    if (!passed) { failedRecipients.push(email); continue }

    try {
      await sendViaResend({ to: email, subject, html, from_name: 'Nova Systems' })
      await logEmail({ direction: 'outbound', from_email: FROM_ADDRESS, to_email: email, subject, body: html, sent: true })
      if (recipient._audit_id) {
        await supabaseFetch(`nova_ai_audits?id=eq.${recipient._audit_id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ outreach_status: `email_sent_day_${sequence_day}`, email_sent_at: new Date().toISOString() }),
        }).catch(() => {})
      }
      total_sent++
    } catch (err) {
      console.error(`[nova-email:send_campaign] Failed for ${email}:`, err.message)
      failedRecipients.push(email)
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return res.status(200).json({ ok: true, campaign_name, sequence_day, total_sent, total_failed: failedRecipients.length, failedRecipients })
}

// ============================================================ ACTION: generate_reply ======

async function handleGenerateReply(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const email_thread = sanitize(b.email_thread, 8000)
  const sender_name = sanitize(b.sender_name, 200) || 'there'
  const sender_email = sanitizeEmail(b.sender_email) || sanitize(b.sender_email, 200)
  const subject = sanitize(b.subject, 300)
  const agent_id = sanitize(b.agent_id, 100) || null
  if (!email_thread) return res.status(400).json({ error: 'email_thread is required' })

  let systemPrompt = 'You are a professional email assistant for Nova Systems. Write helpful, concise email replies. Sound like a real person named Isaac, not a robot. Keep replies under 150 words unless the question requires more detail. Sign off as Isaac Nova, Nova Systems.'
  if (agent_id) {
    const agent = await loadAgentById(agent_id)
    const kb = await loadKnowledgeBase(agent_id)
    if (agent) systemPrompt = buildSystemPrompt(agent, kb, 'You are drafting a professional, concise email reply. Sign off with your name.')
  }

  const userMessage = `Reply to this email. Sender: ${sender_name}. Subject: ${subject}. Email content: ${email_thread}`
  const draft_reply = await callClaude(systemPrompt, userMessage, { maxTokens: 400, temperature: 0.4 })
  const confidence_score = estimateConfidence(email_thread)
  const needs_review = isLowConfidence(confidence_score, 75) || !draft_reply
  const auto_send = !needs_review

  if (needs_review) {
    await alertIsaac(`Nova Email Alert: New email from ${sender_name} about "${subject || '(no subject)'}" needs your review. Check dashboard.`).catch(() => {})
  }

  await logEmail({
    direction: 'inbound', from_email: sender_email || null, to_email: FROM_ADDRESS, subject, body: email_thread,
    ai_draft: draft_reply, confidence_score, needs_review, auto_send, sent: false,
    status: needs_review ? 'needs_review' : 'auto_responded',
  })

  return res.status(200).json({ draft_reply: draft_reply || '', confidence_score, needs_review, auto_send })
}

// ============================================================ ACTION: process_inbound ======
// Kept for whatever inbound-email source posts raw webhook payloads (e.g. Resend inbound
// routing) — categorizes, drafts, and either auto-sends or flags for review in one step.

async function handleProcessInbound(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const from_email = sanitizeEmail(b.from) || sanitize(b.from, 200)
  const to_email = sanitizeEmail(b.to) || FROM_ADDRESS
  const subject = sanitize(b.subject, 300)
  const body = sanitize(b.body || b.text, 8000)

  if (from_email && isStopMessage(body)) {
    await optOutContact(from_email, 'Replied STOP by email')
    await logEmail({ direction: 'inbound', from_email, to_email, subject, body, status: 'opted_out', sent: false })
    return res.status(200).json({ ok: true, status: 'opted_out' })
  }

  await alertHotLeadReply('Email', from_email || 'unknown sender')

  const systemPrompt = `You are a professional email assistant for Nova Systems. Categorize this inbound email as one of: ${CATEGORIES.join(', ')}. Then draft a short, professional reply on behalf of Nova Systems. Return ONLY JSON: {"category":"","draft":"","confidence":0-100}.`
  const raw = await callClaude(systemPrompt, `Subject: ${subject}\nBody: ${body}`, { maxTokens: 400, temperature: 0.3 })
  let category = 'Important', draft = null, confidence = 0
  if (raw) {
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      category = CATEGORIES.includes(parsed.category) ? parsed.category : 'Important'
      draft = parsed.draft || null
      confidence = Number(parsed.confidence) || 0
    } catch (err) {
      console.error('[nova-email:process_inbound] Failed to parse Claude JSON:', err.message)
    }
  }

  const needs_review = isLowConfidence(confidence, 85)
  const status = needs_review ? 'needs_review' : 'auto_responded'

  await logEmail({ direction: 'inbound', from_email, to_email, subject, body, category, ai_draft: draft, sent: status === 'auto_responded', confidence_score: confidence, needs_review, auto_send: !needs_review, status })

  if (status === 'auto_responded' && draft && from_email) {
    const passed = await passesContentFilter(draft, { engine: 'Nova Email', contactLabel: from_email })
    if (passed) {
      try {
        await sendViaResend({ to: from_email, subject: `Re: ${subject}`, html: `<p>${draft}</p>${unsubscribeFooter(from_email)}`, from_name: 'Nova Systems' })
      } catch (err) { await reportEngineError('Nova Email', 'auto-reply', from_email, err) }
    }
  } else if (status === 'needs_review') {
    await alertIsaac(`Nova Email: new "${category}" email from ${from_email || 'unknown'} needs review.`).catch(() => {})
  }

  return res.status(200).json({ ok: true, category, status })
}

// ============================================================ ACTION: daily_summary ========

async function handleDailySummary(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ ok: true, skipped: true })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const r = await supabaseFetch(`nova_ai_email_logs?created_at=gte.${today.toISOString()}`)
  const rows = r.ok ? await r.json() : []

  const received = rows.filter((e) => e.direction === 'inbound').length
  const auto_responded = rows.filter((e) => e.sent && e.auto_send).length
  const needs_review = rows.filter((e) => e.needs_review).length
  const sent = rows.filter((e) => e.direction === 'outbound' && e.sent).length

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  await alertIsaac(
    `Nova Email Daily ${dateLabel}\nReceived: ${received}\nAuto-responded: ${auto_responded}\nNeeds review: ${needs_review}\nSent: ${sent}\nDashboard: nova-wave-one.vercel.app`
  ).catch(() => {})

  return res.status(200).json({ ok: true, received, auto_responded, needs_review, sent })
}

// ============================================================ ACTION: get_emails ===========

async function handleGetEmails(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const q = req.query || {}
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 100))
  const offset = (page - 1) * limit
  const filters = []
  if (q.direction) filters.push(`direction=eq.${encodeURIComponent(q.direction)}`)
  if (q.needs_review != null) filters.push(`needs_review=eq.${q.needs_review === 'true'}`)
  if (q.sent != null) filters.push(`sent=eq.${q.sent === 'true'}`)
  const query = filters.length ? `&${filters.join('&')}` : ''
  const r = await supabaseFetch(`nova_ai_email_logs?order=created_at.desc&limit=${limit}&offset=${offset}${query}`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

async function handleUpdateEmailStatus(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  const patch = {}
  if (b.status) patch.status = sanitize(b.status, 30)
  if (typeof b.sent === 'boolean') patch.sent = b.sent
  if (typeof b.needs_review === 'boolean') patch.needs_review = b.needs_review
  const r = await supabaseFetch(`nova_ai_email_logs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
  if (!r.ok) return res.status(500).json({ error: 'Update failed' })
  return res.status(200).json({ ok: true })
}

// Approve-and-send: takes an edited or as-generated draft sitting in nova_ai_email_logs and
// actually sends it, then marks the row sent.
async function handleApproveSend(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  const to = sanitizeEmail(b.to)
  const subject = sanitize(b.subject, 300)
  const html = sanitize(b.html || b.draft, 20000)
  if (!to || !subject || !html) return res.status(400).json({ error: 'id, to, subject, and html/draft are required' })
  if (await isOptedOut(to)) return res.status(403).json({ success: false, error: 'This contact has opted out and cannot be emailed.' })

  try {
    const data = await sendViaResend({ to, subject, html: html + unsubscribeFooter(to), from_name: 'Nova Systems' })
    if (id && isSupabaseConfigured()) {
      await supabaseFetch(`nova_ai_email_logs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ sent: true, needs_review: false, status: 'auto_responded' }) }).catch(() => {})
    }
    return res.status(200).json({ success: true, email_id: data.id })
  } catch (err) {
    await reportEngineError('Nova Email', 'approve_send', to, err)
    return res.status(500).json({ success: false, error: err.message || 'Send failed' })
  }
}

// ================================================================================= router ==

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''

  switch (action) {
    case 'send_email':          return handleSendEmail(req, res)
    case 'send_campaign':       return handleSendCampaign(req, res)
    case 'generate_reply':      return handleGenerateReply(req, res)
    case 'process_inbound':     return handleProcessInbound(req, res)
    case 'daily_summary':       return handleDailySummary(req, res)
    case 'get_emails':          return handleGetEmails(req, res)
    case 'update_email_status': return handleUpdateEmailStatus(req, res)
    case 'approve_send':        return handleApproveSend(req, res)
    // Back-compat with the earlier stub's action name.
    case 'send_outbound':       return handleSendEmail(req, res)
    default:
      if (req.method === 'GET' && !action) return handleGetEmails(req, res)
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
