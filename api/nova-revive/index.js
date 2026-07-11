// Nova Revive — the always-on background engine that makes sure no lead ever permanently falls
// through the cracks. check_all_leads is the main entry point: it's meant to be run on a
// schedule (see the weekly_report cron in vercel.json — check_all_leads itself can be wired to
// its own cron the same way once a schedule is decided) or triggered manually from the dashboard.
import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import {
  isOptedOut, underDailyRateLimit, passesContentFilter,
  alertIsaac, reportEngineError, personalize, daysSince, logRevive,
} from '../_automation.js'

// Bounds a single check_all_leads run so it can't exceed Vercel's function timeout on a very
// large lead database — a scheduled run every night comfortably works through the whole table
// a few hundred leads at a time.
const MAX_LEADS_PER_RUN = 300

function temperatureFor(days) {
  if (days < 7) return 'Hot'
  if (days < 30) return 'Warm'
  if (days < 90) return 'Cold'
  return 'Frozen'
}

async function mostRecentContactDate(lead) {
  const dates = [lead.created_at]
  try {
    if (lead.phone) {
      const [smsRes, callRes] = await Promise.all([
        supabaseFetch(`nova_ai_sms_logs?contact_phone=eq.${encodeURIComponent(lead.phone)}&order=created_at.desc&limit=1&select=created_at`),
        supabaseFetch(`nova_ai_calls?caller_phone=eq.${encodeURIComponent(lead.phone)}&order=created_at.desc&limit=1&select=created_at`),
      ])
      const smsRows = smsRes.ok ? await smsRes.json() : []
      const callRows = callRes.ok ? await callRes.json() : []
      if (smsRows[0]) dates.push(smsRows[0].created_at)
      if (callRows[0]) dates.push(callRows[0].created_at)
    }
    if (lead.email) {
      const emailRes = await supabaseFetch(`nova_ai_email_logs?to_email=eq.${encodeURIComponent(lead.email)}&order=created_at.desc&limit=1&select=created_at`)
      const emailRows = emailRes.ok ? await emailRes.json() : []
      if (emailRows[0]) dates.push(emailRows[0].created_at)
    }
  } catch (err) {
    console.error(`[nova-revive] Contact lookup failed for lead ${lead.id} (using audit date only):`, err.message)
  }
  return dates.sort((a, b) => new Date(b) - new Date(a))[0]
}

async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) throw new Error('Twilio is not configured')
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body }).toString(),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `Twilio ${r.status}`)
  if (isSupabaseConfigured()) {
    await supabaseFetch('nova_ai_sms_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ contact_phone: to, direction: 'outbound', message: body, message_sid: data.sid, platform: 'sms' }) }).catch(() => {})
  }
  return data
}

async function sendWhatsapp(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) throw new Error('Twilio is not configured')
  const digits = (n) => String(n || '').replace(/[^0-9]/g, '')
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: `whatsapp:+${digits(to).length === 10 ? '1' + digits(to) : digits(to)}`, From: `whatsapp:+${digits(TWILIO_PHONE_NUMBER).length === 10 ? '1' + digits(TWILIO_PHONE_NUMBER) : digits(TWILIO_PHONE_NUMBER)}`, Body: body }).toString(),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `Twilio ${r.status}`)
  if (isSupabaseConfigured()) {
    await supabaseFetch('nova_ai_sms_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ contact_phone: to, direction: 'outbound', message: body, message_sid: data.sid, platform: 'whatsapp' }) }).catch(() => {})
  }
  return data
}

async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Nova Systems <hello@nova-systems.app>', to: [to], subject, html }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `Resend ${r.status}`)
  if (isSupabaseConfigured()) {
    await supabaseFetch('nova_ai_email_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ direction: 'outbound', from_email: 'hello@nova-systems.app', to_email: to, subject, body: html, sent: true }) }).catch(() => {})
  }
  return data
}

function revivalMessageFor(temperature, lead) {
  const tokens = {
    name: lead.owner_name || 'there',
    business_name: lead.business_name || 'your business',
    monthly_leak: lead.revenue_leak_monthly != null ? `$${Number(lead.revenue_leak_monthly).toLocaleString()}` : 'significant monthly revenue',
  }
  if (temperature === 'Warm') {
    return { channel: 'sms', text: personalize('Hey [name] just checking in on [business_name]. Did you get a chance to review that revenue audit we sent? Happy to walk you through it. Reply STOP to opt out.', tokens) }
  }
  if (temperature === 'Cold') {
    return {
      channel: 'email',
      subject: personalize('Still thinking about [business_name] growth?', tokens),
      html: `<p>Hi ${tokens.name}, I wanted to follow up on the Nova Audit we ran for ${tokens.business_name} a while back. We found ${tokens.monthly_leak} per month in recoverable revenue. That opportunity is still there. Book a free 15-minute call at <a href="https://nova-systems.app/welcome">nova-systems.app/welcome</a>.</p><p>Best,<br/>Isaac</p>`,
    }
  }
  if (temperature === 'Frozen') {
    return { channel: 'whatsapp', text: personalize('Hey [name] long time. I know it has been a while. We still have that free audit for [business_name] showing [monthly_leak] per month in recoverable revenue. Worth a quick chat? Reply STOP to opt out.', tokens) }
  }
  return null
}

async function reviveLead(lead, temperature) {
  const plan = revivalMessageFor(temperature, lead)
  if (!plan) return false

  const contactValue = plan.channel === 'email' ? lead.email : lead.phone
  if (!contactValue) return false
  if (await isOptedOut(contactValue)) return false
  if (!(await underDailyRateLimit({ phone: lead.phone, email: lead.email }))) return false

  const textToCheck = plan.channel === 'email' ? plan.html : plan.text
  const passed = await passesContentFilter(textToCheck, { engine: 'Nova Revive', contactLabel: lead.business_name || contactValue })
  if (!passed) return false

  try {
    if (plan.channel === 'sms') await sendSms(lead.phone, plan.text)
    else if (plan.channel === 'whatsapp') {
      // WhatsApp is preferred for Frozen leads, but only if we have any reason to believe the
      // number is reachable there; fall back to email if no phone is on file.
      if (lead.phone) await sendWhatsapp(lead.phone, plan.text)
      else if (lead.email) await sendEmail(lead.email, 'Still thinking about your growth?', `<p>${plan.text}</p>`)
      else return false
    } else if (plan.channel === 'email') await sendEmail(lead.email, plan.subject, plan.html)

    await logRevive({ lead_id: lead.id, channel: plan.channel, message: plan.text || plan.subject, outcome: 'sent' })
    return true
  } catch (err) {
    console.error(`[nova-revive] Failed to revive lead ${lead.id} via ${plan.channel}:`, err.message)
    await logRevive({ lead_id: lead.id, channel: plan.channel, message: plan.text || plan.subject, outcome: 'failed' })
    await reportEngineError('Nova Revive', `send ${plan.channel} revival`, lead.business_name || contactValue, err)
    return false
  }
}

// Never contact the same lead more than once per calendar day, across everything Revive does —
// separate from underDailyRateLimit's 3/day cross-engine cap, this is Revive's own stricter
// once-a-day rule specifically for revival attempts.
async function revivedToday(leadId) {
  if (!isSupabaseConfigured()) return false
  const since = new Date(); since.setHours(0, 0, 0, 0)
  try {
    const r = await supabaseFetch(`nova_ai_revive_logs?lead_id=eq.${encodeURIComponent(leadId)}&created_at=gte.${since.toISOString()}&select=id&limit=1`)
    const rows = r.ok ? await r.json() : []
    return rows.length > 0
  } catch (err) {
    console.error('[nova-revive:revivedToday] Check failed (defaulting to not-revived-today):', err.message)
    return false
  }
}

// ============================================================ ACTION: check_all_leads ======

async function handleCheckAllLeads(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ leads_checked: 0, hot_count: 0, warm_count: 0, cold_count: 0, frozen_count: 0, revival_messages_sent: 0, note: 'Supabase not configured' })

  const r = await supabaseFetch(`nova_ai_audits?became_client=eq.false&opted_out=neq.true&order=created_at.asc&limit=${MAX_LEADS_PER_RUN}`)
  const leads = r.ok ? await r.json() : []

  let hot_count = 0, warm_count = 0, cold_count = 0, frozen_count = 0, revival_messages_sent = 0

  for (const lead of leads) {
    const lastContact = await mostRecentContactDate(lead)
    const days = daysSince(lastContact)
    const temperature = temperatureFor(days)

    if (temperature === 'Hot') hot_count++
    else if (temperature === 'Warm') warm_count++
    else if (temperature === 'Cold') cold_count++
    else frozen_count++

    await supabaseFetch(`nova_ai_audits?id=eq.${lead.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ lead_temperature: temperature, days_since_contact: Math.floor(days) }),
    }).catch((err) => console.error(`[nova-revive] Failed to update temperature for lead ${lead.id}:`, err.message))

    if (temperature === 'Hot') continue // too soon to re-contact
    if (await revivedToday(lead.id)) continue

    const sent = await reviveLead(lead, temperature)
    if (sent) revival_messages_sent++
  }

  return res.status(200).json({ leads_checked: leads.length, hot_count, warm_count, cold_count, frozen_count, revival_messages_sent })
}

// ============================================================ ACTION: run_campaign ==========

async function handleRunCampaign(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const campaign_name = sanitize(b.campaign_name, 200)
  const lead_ids = Array.isArray(b.lead_ids) ? b.lead_ids : []
  const message_template = sanitize(b.message_template, 4000)
  const channels = Array.isArray(b.channels) ? b.channels.filter((c) => ['sms', 'email', 'whatsapp', 'voice'].includes(c)) : ['sms']
  if (!lead_ids.length || !message_template) return res.status(400).json({ error: 'lead_ids and message_template are required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  let sent = 0
  const failed = []

  for (const leadId of lead_ids) {
    const r = await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(leadId)}&limit=1`)
    const lead = r.ok ? (await r.json())[0] : null
    if (!lead) { failed.push(leadId); continue }

    const tokens = { name: lead.owner_name || 'there', business_name: lead.business_name || '', city: lead.city || '', industry: lead.industry || '', monthly_leak: lead.revenue_leak_monthly != null ? `$${Number(lead.revenue_leak_monthly).toLocaleString()}` : '' }
    const text = personalize(message_template, tokens)
    const passed = await passesContentFilter(text, { engine: 'Nova Revive Campaign', contactLabel: lead.business_name || leadId })
    if (!passed) { failed.push(leadId); continue }

    for (const channel of channels) {
      const contactValue = channel === 'email' ? lead.email : lead.phone
      if (!contactValue) continue
      if (await isOptedOut(contactValue)) continue
      if (!(await underDailyRateLimit({ phone: lead.phone, email: lead.email }))) continue

      try {
        if (channel === 'sms') await sendSms(lead.phone, text)
        else if (channel === 'whatsapp') await sendWhatsapp(lead.phone, text)
        else if (channel === 'email') await sendEmail(lead.email, campaign_name || 'Following up', `<p>${text}</p>`)
        else if (channel === 'voice') continue // voice campaigns go through Nova Voice's make_call, not here
        await logRevive({ lead_id: leadId, channel, message: text, outcome: 'sent' })
        sent++
      } catch (err) {
        console.error(`[nova-revive:run_campaign] Failed for lead ${leadId} on ${channel}:`, err.message)
        await logRevive({ lead_id: leadId, channel, message: text, outcome: 'failed' })
        failed.push(leadId)
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  return res.status(200).json({ ok: true, campaign_name, sent, failed_count: failed.length, failed })
}

// ============================================================ ACTION: get_cold_leads ========

async function handleGetColdLeads(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ Hot: [], Warm: [], Cold: [], Frozen: [] })
  const r = await supabaseFetch('nova_ai_audits?became_client=eq.false&opted_out=neq.true&order=days_since_contact.desc.nullslast&limit=500')
  const leads = r.ok ? await r.json() : []

  const grouped = { Hot: [], Warm: [], Cold: [], Frozen: [] }
  for (const l of leads) {
    const temp = l.lead_temperature && grouped[l.lead_temperature] ? l.lead_temperature : temperatureFor(daysSince(l.created_at))
    grouped[temp].push({
      id: l.id, business_name: l.business_name, city: l.city, industry: l.industry,
      overall_score: l.overall_score, revenue_leak_monthly: l.revenue_leak_monthly,
      lead_temperature: temp, days_since_contact: l.days_since_contact ?? Math.floor(daysSince(l.created_at)),
      last_contact_channel: l.outreach_status || 'audit',
    })
  }
  return res.status(200).json(grouped)
}

// ============================================================ ACTION: opt_out_lead ==========

async function handleOptOutLead(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const lead_id = sanitize(b.lead_id, 100)
  const reason = sanitize(b.reason, 300) || 'Manual opt-out'
  if (!lead_id) return res.status(400).json({ error: 'lead_id is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(lead_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ opted_out: true, outreach_status: 'opted_out' }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to opt out lead' })
  await logRevive({ lead_id, channel: 'system', message: reason, outcome: 'opted_out' })
  return res.status(200).json({ success: true })
}

// ============================================================ ACTION: get_revive_logs ======

async function handleGetReviveLogs(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const q = req.query || {}
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 100))
  const offset = (page - 1) * limit
  const filters = []
  if (q.channel) filters.push(`channel=eq.${encodeURIComponent(q.channel)}`)
  if (q.lead_id) filters.push(`lead_id=eq.${encodeURIComponent(q.lead_id)}`)
  const query = filters.length ? `&${filters.join('&')}` : ''
  const r = await supabaseFetch(`nova_ai_revive_logs?order=created_at.desc&limit=${limit}&offset=${offset}${query}`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: weekly_report =========
// Triggered by the Vercel cron in vercel.json (Mondays 9am) — also callable manually.

async function handleWeeklyReport(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ ok: true, skipped: true })
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [auditsRes, smsRes, emailsRes, callsRes, clientsRes, pipelineRes] = await Promise.all([
    supabaseFetch(`nova_ai_audits?created_at=gte.${weekAgo}&select=id`),
    supabaseFetch(`nova_ai_sms_logs?direction=eq.outbound&created_at=gte.${weekAgo}&select=id`),
    supabaseFetch(`nova_ai_email_logs?direction=eq.outbound&created_at=gte.${weekAgo}&select=id`),
    supabaseFetch(`nova_ai_calls?created_at=gte.${weekAgo}&select=id`),
    supabaseFetch(`nova_ai_audits?became_client=eq.true&created_at=gte.${weekAgo}&select=id`),
    supabaseFetch('nova_ai_audits?became_client=eq.false&select=business_name,revenue_leak_monthly&order=revenue_leak_monthly.desc.nullslast&limit=1'),
  ])

  const count = async (r) => (r.ok ? (await r.json()).length : 0)
  const audits = await count(auditsRes)
  const sms = await count(smsRes)
  const emails = await count(emailsRes)
  const calls = await count(callsRes)
  const newClients = await count(clientsRes)
  const topLead = pipelineRes.ok ? (await pipelineRes.json())[0] : null

  const allPipelineRes = await supabaseFetch('nova_ai_audits?became_client=eq.false&select=revenue_leak_monthly')
  const pipelineRows = allPipelineRes.ok ? await allPipelineRes.json() : []
  const pipelineValue = pipelineRows.reduce((sum, r) => sum + (Number(r.revenue_leak_monthly) || 0), 0)

  const message = [
    'Nova Wave One Weekly Report',
    `Audits: ${audits} new this week`,
    `SMS sent: ${sms}`,
    `Emails sent: ${emails}`,
    `Calls made: ${calls}`,
    `New clients: ${newClients}`,
    `Pipeline value: $${pipelineValue.toLocaleString()} per month`,
    topLead ? `Top lead: ${topLead.business_name} - $${Number(topLead.revenue_leak_monthly || 0).toLocaleString()} per month` : 'Top lead: none',
    'Full report: nova-wave-one.vercel.app/dashboard',
  ].join('\n')

  await alertIsaac(message).catch(() => {})
  return res.status(200).json({ ok: true, audits, sms, emails, calls, newClients, pipelineValue })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''

  switch (action) {
    case 'check_all_leads': return handleCheckAllLeads(req, res)
    case 'run_campaign':    return handleRunCampaign(req, res)
    case 'get_cold_leads':  return handleGetColdLeads(req, res)
    case 'opt_out_lead':    return handleOptOutLead(req, res)
    case 'get_revive_logs': return handleGetReviveLogs(req, res)
    case 'weekly_report':   return handleWeeklyReport(req, res)
    // Back-compat with the earlier stub's action name.
    case 'get_queue':       return handleGetColdLeads(req, res)
    default:
      if (req.method === 'GET' && !action) return handleGetColdLeads(req, res)
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
