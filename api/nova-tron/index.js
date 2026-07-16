// Nova Tron — world intelligence engine. Pulls free, no-key trend sources every 6 hours and
// asks Claude to turn them into Connecticut-specific, actionable intelligence for every other
// engine (mainly Nova Media's content calendar and Isaac's morning brief).
import { setCors } from '../_cors.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { alertIsaac } from '../_automation.js'
import { createRecommendation } from '../_recommendations.js'

async function fetchGoogleTrends() {
  try {
    const r = await fetch('https://trends.google.com/trends/trendingsearches/daily/rss?geo=US', { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const xml = await r.text()
    const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)].map((m) => m[1]).filter((t) => t && t !== 'Daily Search Trends')
    return titles.slice(0, 20)
  } catch (err) { console.error('[nova-tron] Google Trends fetch failed:', err.message); return [] }
}

async function fetchReddit(subreddit) {
  try {
    const r = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?limit=10&t=day`, { headers: { 'User-Agent': 'NovaTron/1.0' }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const data = await r.json()
    return (data?.data?.children || []).map((c) => c.data?.title).filter(Boolean)
  } catch (err) { console.error(`[nova-tron] Reddit r/${subreddit} fetch failed:`, err.message); return [] }
}

async function fetchHackerNews() {
  try {
    const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { signal: AbortSignal.timeout(8000) })
    const ids = (await idsRes.json()).slice(0, 10)
    const stories = await Promise.all(ids.map((id) => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json()).catch(() => null)))
    return stories.filter(Boolean).map((s) => s.title).filter(Boolean)
  } catch (err) { console.error('[nova-tron] Hacker News fetch failed:', err.message); return [] }
}

let _anthropic = null
async function claude() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

// ============================================================ ACTION: run_analysis ===========

async function handleRunAnalysis(req, res) {
  const [googleTrends, smallBiz, aiSubreddit, ctSubreddit, hn] = await Promise.all([
    fetchGoogleTrends(), fetchReddit('smallbusiness'), fetchReddit('artificial'), fetchReddit('Connecticut'), fetchHackerNews(),
  ])

  const raw = { googleTrends, smallBiz, aiSubreddit, ctSubreddit, hn }
  const client = await claude()
  let analysis = null

  if (client) {
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1800, temperature: 0.6,
        system: 'You are an intelligence analyst for Nova Systems, a Connecticut AI company serving small businesses. Analyze these trending topics and news items. Return ONLY a JSON object with: connecticut_opportunities (array of 3 local business opportunities — real prospecting targets), ai_developments (array of 3 AI news items relevant to our services), content_ideas (array of 5 social media content ideas, each an object with platform, format, angle, and caption), alerts (array of any urgent items Nova Systems should know about, empty array if none), pricing_signals (array of 0-2 real market/cost signals relevant to what Nova Systems or its clients should charge, empty array if none apply), compliance_signals (array of 0-2 real regulatory/compliance-relevant developments, framed as "worth organizing/tracking," never as legal advice, empty array if none), reputation_signals (array of 0-2 real reputation/review-relevant trends, empty array if none), seasonal_demand_signals (array of 0-2 real signals about upcoming seasonal demand shifts relevant to service businesses, empty array if none), reactivation_opportunities (array of 0-2 real signals suggesting past/cold leads worth re-engaging now, e.g. a competitor struggling or a seasonal trigger, empty array if none). Every array entry must be grounded in the real trending data provided — never invent a signal with no basis in it. Be specific and actionable.',
        messages: [{ role: 'user', content: JSON.stringify(raw) }],
      })
      const text = msg.content?.[0]?.text || '{}'
      const match = text.match(/\{[\s\S]*\}/)
      analysis = JSON.parse(match ? match[0] : text)
    } catch (err) {
      console.error('[nova-tron:run_analysis] Claude call failed:', err.message)
    }
  }
  if (!analysis) {
    analysis = {
      connecticut_opportunities: [], ai_developments: [], content_ideas: [],
      alerts: ['ANTHROPIC_API_KEY not configured — raw trend data collected but not analyzed.'],
      pricing_signals: [], compliance_signals: [], reputation_signals: [],
      seasonal_demand_signals: [], reactivation_opportunities: [],
    }
  }

  let saved = null
  if (isSupabaseConfigured()) {
    const r = await supabaseFetch('nova_tron_trends', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        connecticut_opportunities: analysis.connecticut_opportunities || [],
        ai_developments: analysis.ai_developments || [],
        content_ideas: analysis.content_ideas || [],
        alerts: analysis.alerts || [],
        pricing_signals: analysis.pricing_signals || [],
        compliance_signals: analysis.compliance_signals || [],
        reputation_signals: analysis.reputation_signals || [],
        seasonal_demand_signals: analysis.seasonal_demand_signals || [],
        reactivation_opportunities: analysis.reactivation_opportunities || [],
      }),
    })
    saved = r.ok ? (await r.json())[0] : null
  }

  // Fan out real signals to the engines that can actually act on them — this is what stops Nova
  // Tron (Intelligence) from being an island. Each recommendation is grounded in this run's real
  // analysis output, not invented, and each resolves via the shared primitive per the governing
  // rule (every recommendation must do something).
  const asText = (v) => (typeof v === 'string' ? v : JSON.stringify(v))
  const fanOut = []

  const topIdea = analysis.content_ideas?.[0]
  if (topIdea) {
    fanOut.push(createRecommendation({
      engine: 'media', sourceEngines: ['tron'],
      message: `Trending content opportunity for ${topIdea.platform || 'social media'}: ${topIdea.angle || topIdea.caption || 'new idea'}`,
      recommended_action: `Generate a ${topIdea.format || 'post'}: "${topIdea.caption || topIdea.angle}"`,
      resolution: 'task', assignTo: 'media', evidence: topIdea, confidence: 65,
    }))
  }
  const topOpp = analysis.connecticut_opportunities?.[0]
  if (topOpp) {
    fanOut.push(createRecommendation({
      engine: 'sales', sourceEngines: ['tron'],
      message: `Market opportunity: ${asText(topOpp).slice(0, 400)}`,
      recommended_action: 'Review this opportunity for outbound prospecting.',
      resolution: 'task', assignTo: 'sales', evidence: topOpp, confidence: 55,
    }))
  }
  const topDev = analysis.ai_developments?.[0]
  if (topDev) {
    fanOut.push(createRecommendation({
      engine: 'audit', sourceEngines: ['tron'],
      message: `Industry/AI development relevant to client audits: ${asText(topDev).slice(0, 400)}`,
      recommended_action: 'Factor into competitive/industry benchmark commentary on the next audit run.',
      resolution: 'crm_update', evidence: topDev, confidence: 50,
    }))
  }
  for (const alert of analysis.alerts || []) {
    fanOut.push(createRecommendation({
      engine: 'insights', sourceEngines: ['tron'],
      message: asText(alert), recommended_action: 'Review and decide whether action is needed.',
      resolution: 'notify', confidence: 70,
    }))
  }
  const pricingSignal = analysis.pricing_signals?.[0]
  if (pricingSignal) {
    fanOut.push(createRecommendation({
      engine: 'finances', sourceEngines: ['tron'],
      message: `Market pricing signal: ${asText(pricingSignal).slice(0, 400)}`,
      recommended_action: 'Review current pricing against this signal.',
      resolution: 'task', assignTo: 'finances', evidence: pricingSignal, confidence: 50,
    }))
  }
  const complianceSignal = analysis.compliance_signals?.[0]
  if (complianceSignal) {
    fanOut.push(createRecommendation({
      engine: 'law', sourceEngines: ['tron'],
      message: `Compliance-relevant development (not legal advice — for organization/tracking only): ${asText(complianceSignal).slice(0, 400)}`,
      recommended_action: 'Review and add to the compliance checklist if applicable.',
      resolution: 'task', assignTo: 'law', evidence: complianceSignal, confidence: 45,
    }))
  }
  const reputationSignal = analysis.reputation_signals?.[0]
  if (reputationSignal) {
    fanOut.push(createRecommendation({
      engine: 'reviews', sourceEngines: ['tron'],
      message: `Reputation trend: ${asText(reputationSignal).slice(0, 400)}`,
      recommended_action: 'Consider proactive review requests or response strategy.',
      resolution: 'task', assignTo: 'reviews', evidence: reputationSignal, confidence: 45,
    }))
  }
  const seasonalSignal = analysis.seasonal_demand_signals?.[0]
  if (seasonalSignal) {
    fanOut.push(createRecommendation({
      engine: 'book', sourceEngines: ['tron'],
      message: `Seasonal demand signal: ${asText(seasonalSignal).slice(0, 400)}`,
      recommended_action: 'Review staffing/availability ahead of this demand shift.',
      resolution: 'task', assignTo: 'book', evidence: seasonalSignal, confidence: 45,
    }))
  }
  const reactivationSignal = analysis.reactivation_opportunities?.[0]
  if (reactivationSignal) {
    fanOut.push(createRecommendation({
      engine: 'revive', sourceEngines: ['tron'],
      message: `Reactivation opportunity: ${asText(reactivationSignal).slice(0, 400)}`,
      recommended_action: 'Consider a targeted win-back push tied to this signal.',
      resolution: 'task', assignTo: 'revive', evidence: reactivationSignal, confidence: 45,
    }))
  }
  await Promise.all(fanOut)

  const alert = analysis.alerts?.[0]
  await alertIsaac(
    `Nova Tron Morning Brief. Top opportunity: ${topOpp ? asText(topOpp).slice(0, 150) : 'None today'}. Content idea: ${topIdea ? (topIdea.caption || topIdea.angle || '').slice(0, 150) : 'None today'}. Alert: ${alert || 'None today'}. ${fanOut.length} recommendation(s) sent to other engines. Full brief in dashboard.`
  ).catch(() => {})

  return res.status(200).json({ ok: true, analysis: saved || analysis, recommendations_sent: fanOut.length })
}

// ============================================================ ACTION: get_latest =============

async function handleGetLatest(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json(null)
  const r = await supabaseFetch('nova_tron_trends?order=created_at.desc&limit=1')
  const rows = r.ok ? await r.json() : []
  return res.status(200).json(rows[0] || null)
}

// ============================================================ ACTION: get_content_ideas =======

async function handleGetContentIdeas(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_tron_trends?order=created_at.desc&limit=5&select=content_ideas,created_at')
  const rows = r.ok ? await r.json() : []
  return res.status(200).json(rows.flatMap((row) => (row.content_ideas || []).map((idea) => ({ ...idea, from: row.created_at }))))
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Tron', ['ANTHROPIC_API_KEY', 'TWILIO_PHONE_NUMBER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'run_analysis':      return await handleRunAnalysis(req, res)
      case 'get_latest':        return await handleGetLatest(req, res)
      case 'get_content_ideas': return await handleGetContentIdeas(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Tron] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
