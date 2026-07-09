import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'

const CATEGORIES = ['Important', 'Client', 'Lead', 'Spam', 'Automated']

async function categorize(subject, body) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { category: 'Important', draft: null, confidence: 0 }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Categorize this inbound email as one of: ${CATEGORIES.join(', ')}. Then draft a short, professional reply on behalf of Nova Systems. Return ONLY JSON: {"category":"","draft":"","confidence":0-100}.\n\nSubject: ${subject}\nBody: ${body}`,
        }],
      }),
    })
    const data = await r.json()
    const text = data.content?.[0]?.text || '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : text)
    return { category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Important', draft: parsed.draft || null, confidence: Number(parsed.confidence) || 0 }
  } catch (err) {
    console.error('[nova-email:categorize] Error:', err.message)
    return { category: 'Important', draft: null, confidence: 0 }
  }
}

async function handleProcessInbound(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const from_email = sanitizeEmail(b.from) || sanitize(b.from, 200)
  const to_email = sanitizeEmail(b.to) || 'hello@nova-systems.app'
  const subject = sanitize(b.subject, 300)
  const body = sanitize(b.body || b.text, 8000)

  const { category, draft, confidence } = await categorize(subject, body)
  const status = confidence >= 85 ? 'auto_responded' : 'needs_review'

  if (isSupabaseConfigured()) {
    try {
      await supabaseFetch('nova_ai_email_logs', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ direction: 'inbound', from_email, to_email, subject, body, category, ai_draft: draft, sent: status === 'auto_responded', confidence_score: confidence, status }),
      })
    } catch (err) { console.error('[nova-email:process_inbound] Save failed:', err.message) }
  }

  if (status === 'auto_responded' && draft && from_email && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Nova Systems <noreply@nova-systems.app>', to: [from_email], subject: `Re: ${subject}`, html: `<p>${draft}</p>` }),
      })
    } catch (err) { console.error('[nova-email:process_inbound] Auto-reply failed:', err.message) }
  } else if (status === 'needs_review' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: process.env.TWILIO_PHONE_NUMBER, From: process.env.TWILIO_PHONE_NUMBER, Body: `Nova Email: new "${category}" email from ${from_email} needs review.` }).toString(),
      })
    } catch (err) { console.error('[nova-email:process_inbound] Alert SMS failed:', err.message) }
  }

  return res.status(200).json({ ok: true, category, status })
}

async function handleSendOutbound(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const to = sanitizeEmail(b.to)
  const subject = sanitize(b.subject, 300)
  const html = sanitize(b.html || b.body, 8000)
  if (!to || !subject) return res.status(400).json({ error: 'to and subject are required' })
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Resend is not configured' })

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Nova Systems <noreply@nova-systems.app>', to: [to], subject, html: `<p>${html}</p>` }),
    })
    if (!r.ok) throw new Error(`Resend ${r.status}`)
    if (isSupabaseConfigured()) {
      await supabaseFetch('nova_ai_email_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ direction: 'outbound', from_email: 'noreply@nova-systems.app', to_email: to, subject, body: html, sent: true }) }).catch(() => {})
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Send failed' })
  }
}

async function handleSendCampaign(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const subject = sanitize(b.subject, 300)
  const body = sanitize(b.body, 8000)
  if (!subject || !body) return res.status(400).json({ error: 'subject and body are required' })

  if (!isSupabaseConfigured()) return res.status(200).json({ ok: true, queued: 0, note: 'Supabase not configured — nothing to send to.' })

  try {
    const r = await supabaseFetch("nova_ai_audits?outreach_status=eq.pending&email=not.is.null&select=id,business_name,owner_name,city,industry,overall_score,revenue_leak_monthly,email,competitor_data")
    const leads = r.ok ? await r.json() : []
    let sent = 0
    for (const lead of leads) {
      const personalized = body
        .replace(/\[business_name\]/g, lead.business_name || '')
        .replace(/\[owner_name\]/g, lead.owner_name || 'there')
        .replace(/\[city\]/g, lead.city || '')
        .replace(/\[industry\]/g, lead.industry || '')
        .replace(/\[score\]/g, String(lead.overall_score ?? ''))
        .replace(/\[monthly_leak\]/g, `$${(lead.revenue_leak_monthly || 0).toLocaleString()}`)
        .replace(/\[competitor_1\]/g, lead.competitor_data?.[0]?.name || 'a competitor')
      if (!process.env.RESEND_API_KEY) continue
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Nova Systems <noreply@nova-systems.app>', to: [lead.email], subject: subject.replace(/\[business_name\]/g, lead.business_name || ''), html: `<p>${personalized}</p>` }),
        })
        sent++
        await supabaseFetch(`nova_ai_audits?id=eq.${lead.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ outreach_status: 'email_sent', email_sent_at: new Date().toISOString() }) })
      } catch (err) { console.error('[nova-email:send_campaign] Failed for', lead.business_name, err.message) }
    }
    return res.status(200).json({ ok: true, queued: leads.length, sent })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Campaign send failed' })
  }
}

async function handleDailySummary(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ ok: true, skipped: true })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const r = await supabaseFetch(`nova_ai_email_logs?created_at=gte.${today.toISOString()}`)
  const rows = r.ok ? await r.json() : []
  const autoResponded = rows.filter((e) => e.status === 'auto_responded').length
  const needsReview = rows.filter((e) => e.status === 'needs_review').length
  const spam = rows.filter((e) => e.category === 'Spam').length

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          To: process.env.TWILIO_PHONE_NUMBER, From: process.env.TWILIO_PHONE_NUMBER,
          Body: `Nova Email Daily Report. Auto-responded: ${autoResponded}. Needs review: ${needsReview}. Spam deleted: ${spam}. Full report: nova-systems.agency/dashboard/email`,
        }).toString(),
      })
    } catch (err) { console.error('[nova-email:daily_summary] SMS failed:', err.message) }
  }
  return res.status(200).json({ ok: true, autoResponded, needsReview, spam })
}

async function handleGetEmails(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_email_logs?order=created_at.desc&limit=100')
  return res.status(200).json(r.ok ? await r.json() : [])
}

async function handleUpdateEmailStatus(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  const status = sanitize(b.status, 30)
  if (!id || !status) return res.status(400).json({ error: 'id and status are required' })
  const r = await supabaseFetch(`nova_ai_email_logs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status }) })
  if (!r.ok) return res.status(500).json({ error: 'Update failed' })
  return res.status(200).json({ ok: true })
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''

  switch (action) {
    case 'process_inbound':    return handleProcessInbound(req, res)
    case 'send_outbound':      return handleSendOutbound(req, res)
    case 'send_campaign':      return handleSendCampaign(req, res)
    case 'daily_summary':      return handleDailySummary(req, res)
    case 'get_emails':         return handleGetEmails(req, res)
    case 'update_email_status': return handleUpdateEmailStatus(req, res)
    default:
      if (req.method === 'GET' && !action) return handleGetEmails(req, res)
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
