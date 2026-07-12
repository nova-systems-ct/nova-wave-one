// Nova Knowledge — the centralized per-agent knowledge base every other engine reads before
// generating a response. Manages the nova_ai_knowledge_bases row for each agent and exposes the
// same buildSystemPrompt() logic used by every engine as a standalone action so the dashboard
// can preview exactly what the AI sees.
import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { buildSystemPrompt, callClaude } from '../_agents.js'

const SECTIONS = [
  'business_name', 'business_description', 'services', 'pricing', 'hours', 'address',
  'booking_process', 'staff', 'policies', 'tone', 'never_say', 'always_say', 'escalation', 'competitors',
]

// ============================================================ ACTION: get_knowledge =========

async function handleGetKnowledge(req, res) {
  const agent_id = sanitize(req.query?.agent_id, 100)
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' })
  if (!isSupabaseConfigured()) return res.status(200).json(null)
  const r = await supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(agent_id)}&limit=1`)
  const rows = r.ok ? await r.json() : []
  return res.status(200).json(rows[0] || null)
}

// ============================================================ ACTION: update_section =========
// Upserts one or more knowledge base fields for an agent. Accepts any subset of SECTIONS plus
// `faqs` (array of {q,a}) so the dashboard editor can save one section at a time.

async function handleUpdateSection(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const agent_id = sanitize(b.agent_id, 100)
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const patch = {}
  for (const key of SECTIONS) {
    if (key in b) patch[key] = typeof b[key] === 'string' ? sanitize(b[key], 8000) : b[key]
  }
  if (Array.isArray(b.faqs)) patch.faqs = b.faqs.slice(0, 100)

  const existing = await supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(agent_id)}&limit=1`)
  const rows = existing.ok ? await existing.json() : []

  let r
  if (rows[0]) {
    r = await supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(agent_id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
    })
  } else {
    r = await supabaseFetch('nova_ai_knowledge_bases', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ agent_id, ...patch }),
    })
  }
  if (!r.ok) return res.status(500).json({ error: 'Failed to save knowledge base' })
  const saved = await r.json()
  return res.status(200).json({ ok: true, knowledge: saved[0] })
}

// ============================================================ ACTION: scrape_url =============
// Fetches a URL, strips tags down to readable text, and asks Claude to summarize it into a
// short paragraph suitable for pasting into business_description or services.

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function handleScrapeUrl(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const url = sanitize(b.url, 500)
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'A valid http(s) url is required' })

  try {
    const pageRes = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!pageRes.ok) return res.status(400).json({ error: `Could not fetch that page (HTTP ${pageRes.status})` })
    const html = await pageRes.text()
    const text = stripHtml(html).slice(0, 12000)

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(200).json({ ok: true, raw_text: text.slice(0, 3000), summary: null, note: 'ANTHROPIC_API_KEY not configured — returning raw extracted text only' })
    }

    const summary = await callClaude(
      'You summarize business website content into clean, factual reference text for a knowledge base. No marketing fluff, no speculation — only what is actually stated on the page.',
      `Summarize the business information on this page in under 400 words, organized as plain text a knowledge base editor could paste directly in: name, what they do, services, hours, location if present.\n\nPage text:\n${text}`,
      { maxTokens: 600, temperature: 0.2 }
    )
    return res.status(200).json({ ok: true, summary: summary || null, raw_text: text.slice(0, 3000) })
  } catch (err) {
    console.error('[nova-knowledge:scrape_url] Failed:', err.message)
    return res.status(500).json({ error: `Could not read that page: ${err.message}` })
  }
}

// ============================================================ ACTION: upload_pdf =============
// Accepts a base64-encoded PDF from the browser (no multipart handling needed), extracts text.

async function handleUploadPdf(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const base64 = typeof b.file_base64 === 'string' ? b.file_base64 : ''
  if (!base64) return res.status(400).json({ error: 'file_base64 is required' })

  try {
    const pdfParse = (await import('pdf-parse')).default
    const buffer = Buffer.from(base64.replace(/^data:application\/pdf;base64,/, ''), 'base64')
    const data = await pdfParse(buffer)
    const text = (data.text || '').replace(/\s+/g, ' ').trim().slice(0, 20000)
    return res.status(200).json({ ok: true, text })
  } catch (err) {
    console.error('[nova-knowledge:upload_pdf] Failed:', err.message)
    return res.status(500).json({ error: `Could not read that PDF: ${err.message}` })
  }
}

// ============================================================ ACTION: get_system_prompt ======

async function handleGetSystemPrompt(req, res) {
  const agent_id = sanitize(req.query?.agent_id, 100)
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' })
  if (!isSupabaseConfigured()) return res.status(200).json({ system_prompt: '' })

  const [agentRes, kbRes] = await Promise.all([
    supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(agent_id)}&limit=1`),
    supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(agent_id)}&limit=1`),
  ])
  const agent = agentRes.ok ? (await agentRes.json())[0] : null
  const kb = kbRes.ok ? (await kbRes.json())[0] : null
  const prompt = buildSystemPrompt(agent, kb, 'This is a preview of the base system prompt — each channel (SMS, voice, email, social) appends its own tone instructions on top of this.')
  return res.status(200).json({ system_prompt: prompt })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Knowledge', ['SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'get_knowledge':      return await handleGetKnowledge(req, res)
      case 'update_section':     return await handleUpdateSection(req, res)
      case 'scrape_url':         return await handleScrapeUrl(req, res)
      case 'upload_pdf':         return await handleUploadPdf(req, res)
      case 'get_system_prompt':  return await handleGetSystemPrompt(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Knowledge] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
