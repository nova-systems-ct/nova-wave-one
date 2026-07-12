// Nova Tron — world intelligence engine. Pulls free, no-key trend sources every 6 hours and
// asks Claude to turn them into Connecticut-specific, actionable intelligence for every other
// engine (mainly Nova Media's content calendar and Isaac's morning brief).
import { setCors } from '../_cors.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { alertIsaac } from '../_automation.js'

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
        model: 'claude-haiku-4-5-20251001', max_tokens: 1200, temperature: 0.6,
        system: 'You are an intelligence analyst for Nova Systems, a Connecticut AI company serving small businesses. Analyze these trending topics and news items. Return ONLY a JSON object with: connecticut_opportunities (array of 3 local business opportunities), ai_developments (array of 3 AI news items relevant to our services), content_ideas (array of 5 social media content ideas, each an object with platform, format, angle, and caption), alerts (array of any urgent items Nova Systems should know about, empty array if none). Be specific and actionable.',
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
      }),
    })
    saved = r.ok ? (await r.json())[0] : null
  }

  const topOpp = analysis.connecticut_opportunities?.[0]
  const topIdea = analysis.content_ideas?.[0]
  const alert = analysis.alerts?.[0]
  await alertIsaac(
    `Nova Tron Morning Brief. Top opportunity: ${topOpp ? (typeof topOpp === 'string' ? topOpp : JSON.stringify(topOpp)).slice(0, 150) : 'None today'}. Content idea: ${topIdea ? (topIdea.caption || topIdea.angle || '').slice(0, 150) : 'None today'}. Alert: ${alert || 'None today'}. Full brief in dashboard.`
  ).catch(() => {})

  return res.status(200).json({ ok: true, analysis: saved || analysis })
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
