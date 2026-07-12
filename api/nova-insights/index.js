// Nova Insights — executive AI advisor. Collects real stats from every engine's tables and asks
// Claude to write a plain-English briefing, not a dashboard of numbers.
import { setCors } from '../_cors.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { alertIsaac } from '../_automation.js'

let _anthropic = null
async function claude() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

async function collectStats(sinceIso) {
  const count = async (table, extraFilter = '') => {
    if (!isSupabaseConfigured()) return 0
    const r = await supabaseFetch(`${table}?select=id&created_at=gte.${sinceIso}${extraFilter}`)
    return r.ok ? (await r.json()).length : 0
  }

  const [calls, sms, emails, meetings, leads, socialReplies, reviews] = await Promise.all([
    count('nova_ai_calls'),
    count('nova_ai_sms_logs', '&direction=eq.outbound'),
    count('nova_ai_email_logs'),
    count('nova_book_meetings'),
    count('nova_crm_contacts'),
    count('nova_ai_social_logs'),
    count('nova_reviews'),
  ])

  let pipelineValue = 0, topLead = null
  if (isSupabaseConfigured()) {
    const dealsRes = await supabaseFetch('nova_crm_deals?select=value,stage&stage=neq.churned')
    const deals = dealsRes.ok ? await dealsRes.json() : []
    pipelineValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)

    const staleRes = await supabaseFetch("nova_crm_contacts?status=neq.churned&status=neq.active_client&order=updated_at.asc&limit=1")
    const stale = staleRes.ok ? (await staleRes.json())[0] : null
    if (stale) {
      const days = Math.floor((Date.now() - new Date(stale.updated_at).getTime()) / 86400000)
      topLead = { ...stale, days_since_contact: days }
    }
  }

  return { calls, sms, emails, meetings, leads, socialReplies, reviews, pipelineValue, topLead }
}

// ============================================================ ACTION: get_stats =============

async function handleGetStats(req, res) {
  const since = new Date(); since.setHours(0, 0, 0, 0)
  const stats = await collectStats(since.toISOString())
  return res.status(200).json(stats)
}

// ============================================================ ACTION: generate_briefing ======

function fallbackBriefing(stats) {
  const lead = stats.topLead
  const leadLine = lead
    ? `Your highest priority lead today is ${lead.business_name || 'an unnamed contact'}, not contacted in ${lead.days_since_contact} days. Recommended action: reach out today before they go cold.`
    : 'No leads are overdue for contact right now — pipeline is current.'
  return `Today at Nova Systems. Yesterday you had ${stats.calls} calls answered, ${stats.leads} leads captured, ${stats.meetings} meetings booked, and $${stats.pipelineValue.toLocaleString()} in pipeline. ${leadLine}`
}

async function handleGenerateBriefing(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const stats = await collectStats(yesterday.toISOString())

  let briefing_text = null
  const client = await claude()
  if (client) {
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 400,
        temperature: 0.5,
        system: 'You are Nova Insights, the executive AI advisor for Nova Systems, a Connecticut AI company run by Isaac Nova. Write a concise daily business briefing based on the real data provided. Be specific, actionable, and direct. Sound like a trusted business advisor not a robot. Include: what happened yesterday, what needs attention today, one specific recommendation, and one opportunity. Keep it under 200 words. Format as plain paragraphs not bullet points.',
        messages: [{ role: 'user', content: `Yesterday's real data:\n${JSON.stringify(stats, null, 2)}` }],
      })
      briefing_text = msg.content?.[0]?.text?.trim() || null
    } catch (err) {
      console.error('[nova-insights:generate_briefing] Claude call failed:', err.message)
    }
  }
  if (!briefing_text) briefing_text = fallbackBriefing(stats)

  let saved = null
  if (isSupabaseConfigured()) {
    const r = await supabaseFetch('nova_insights_briefings', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ briefing_text, briefing_type: 'daily', stats_snapshot: stats }),
    })
    saved = r.ok ? (await r.json())[0] : null
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  await alertIsaac(`Nova Insights ${dateLabel}: ${briefing_text.slice(0, 300)}${briefing_text.length > 300 ? '…' : ''}`).catch(() => {})

  return res.status(200).json({ ok: true, briefing: saved || { briefing_text, stats_snapshot: stats } })
}

// ============================================================ ACTION: get_anomalies ==========
// Compares today's counts to the trailing 7-day daily average per metric; flags >25% swings.

async function handleGetAnomalies(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const [todayStats, weekRes] = await Promise.all([
    collectStats(today.toISOString()),
    supabaseFetch(`nova_ai_calls?select=id,created_at&created_at=gte.${weekAgo.toISOString()}`),
  ])
  const weekCalls = weekRes.ok ? await weekRes.json() : []
  const avgDailyCalls = weekCalls.length / 7

  const anomalies = []
  if (avgDailyCalls > 2 && Math.abs(todayStats.calls - avgDailyCalls) / avgDailyCalls > 0.25) {
    const direction = todayStats.calls > avgDailyCalls ? 'above' : 'below'
    anomalies.push({
      metric: 'Calls', today: todayStats.calls, average: Math.round(avgDailyCalls * 10) / 10,
      explanation: `Today's call volume is ${direction} the 7-day average of ${avgDailyCalls.toFixed(1)}/day by more than 25%.`,
    })
  }
  return res.status(200).json(anomalies)
}

// ============================================================ ACTION: generate_weekly_report =

async function handleGenerateWeeklyReport(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const stats = await collectStats(weekAgo.toISOString())

  let report_text = null
  const client = await claude()
  if (client) {
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        temperature: 0.5,
        system: 'You are Nova Insights, executive AI advisor for Nova Systems. Write a comprehensive weekly business report from the real data given: performance, trends, wins, and priorities for next week. Direct and specific, not generic. Under 350 words, plain paragraphs.',
        messages: [{ role: 'user', content: `This week's real data:\n${JSON.stringify(stats, null, 2)}` }],
      })
      report_text = msg.content?.[0]?.text?.trim() || null
    } catch (err) {
      console.error('[nova-insights:generate_weekly_report] Claude call failed:', err.message)
    }
  }
  if (!report_text) report_text = fallbackBriefing(stats)

  if (isSupabaseConfigured()) {
    await supabaseFetch('nova_insights_briefings', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ briefing_text: report_text, briefing_type: 'weekly', stats_snapshot: stats }),
    }).catch(() => {})
  }

  await alertIsaac(`Nova Wave One Weekly Report: ${report_text.slice(0, 300)}${report_text.length > 300 ? '…' : ''}`).catch(() => {})
  return res.status(200).json({ ok: true, report_text, stats })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Insights', ['ANTHROPIC_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'generate_briefing':       return await handleGenerateBriefing(req, res)
      case 'get_stats':               return await handleGetStats(req, res)
      case 'get_anomalies':           return await handleGetAnomalies(req, res)
      case 'generate_weekly_report':  return await handleGenerateWeeklyReport(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Insights] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
