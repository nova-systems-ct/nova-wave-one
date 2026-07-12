// Nova Sales — AI sales department: lead scoring, outbound prospecting, sales coaching, and
// proposal generation. Reads from Nova CRM, writes back scores/proposals/coaching to it.
import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { onInteraction } from '../_integrations.js'
import { getMemory } from '../_memory.js'

let _anthropic = null
async function claude() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

// ============================================================ ACTION: score_lead ============

async function handleScoreLead(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const contact_id = sanitize(b.contact_id, 100)
  if (!contact_id) return res.status(400).json({ error: 'contact_id is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const [contactRes, activitiesRes, auditRes] = await Promise.all([
    supabaseFetch(`nova_crm_contacts?id=eq.${contact_id}&limit=1`),
    supabaseFetch(`nova_crm_activities?contact_id=eq.${contact_id}&order=created_at.desc&limit=20`),
    supabaseFetch(`nova_ai_audits?id=eq.${contact_id}&limit=1`),
  ])
  const contact = contactRes.ok ? (await contactRes.json())[0] : null
  if (!contact) return res.status(404).json({ error: 'Contact not found' })
  const activities = activitiesRes.ok ? await activitiesRes.json() : []
  const daysSinceContact = Math.floor((Date.now() - new Date(contact.updated_at).getTime()) / 86400000)

  let auditScore = null
  if (contact.audit_id) {
    const r = await supabaseFetch(`nova_ai_audits?id=eq.${contact.audit_id}&limit=1`)
    const rows = r.ok ? await r.json() : []
    auditScore = rows[0] || null
  }

  const client = await claude()
  let score = null, reasoning = ''
  if (client) {
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 300, temperature: 0.3,
        system: 'You are a B2B sales lead-scoring analyst. Return ONLY JSON: {"score": 0-100, "reasoning": "one sentence"}.',
        messages: [{ role: 'user', content: `Score this lead 0-100 based on: audit score ${auditScore?.overall_score ?? 'unknown'}, monthly revenue leak $${auditScore?.revenue_leak_monthly ?? 'unknown'}, industry ${contact.industry}, ${activities.length} past interactions, ${daysSinceContact} days since last contact, current status ${contact.status}.` }],
      })
      const text = msg.content?.[0]?.text || '{}'
      const match = text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : text)
      score = Math.max(0, Math.min(100, Number(parsed.score) || 0))
      reasoning = parsed.reasoning || ''
    } catch (err) {
      console.error('[nova-sales:score_lead] Claude call failed:', err.message)
    }
  }
  if (score == null) {
    // Deterministic fallback so scoring always returns something even without Claude.
    score = Math.max(0, Math.min(100, Math.round((auditScore?.overall_score || 50) * 0.5 + Math.max(0, 30 - daysSinceContact) + activities.length * 2)))
    reasoning = 'Fallback scoring (ANTHROPIC_API_KEY not configured) based on audit score, recency, and activity count.'
  }

  await supabaseFetch(`nova_crm_contacts?id=eq.${contact_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ lead_score: score }) })
  return res.status(200).json({ ok: true, score, reasoning })
}

// ============================================================ ACTION: get_prospects ==========

async function handleGetProspects(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch("nova_crm_contacts?status=neq.active_client&status=neq.churned&order=lead_score.desc.nullslast&limit=100")
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: log_call ===============

async function handleLogCall(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const contact_id = sanitize(b.contact_id, 100)
  const outcome_notes = sanitize(b.outcome_notes, 4000)
  if (!contact_id || !outcome_notes) return res.status(400).json({ error: 'contact_id and outcome_notes are required' })

  const client = await claude()
  let coaching = 'Coaching unavailable — ANTHROPIC_API_KEY not configured.'
  if (client) {
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 300, temperature: 0.5,
        system: 'You are a sales coach for a Connecticut AI company. Give specific, direct feedback on a call outcome: what went well, what to improve, what to try next time. Under 120 words.',
        messages: [{ role: 'user', content: outcome_notes }],
      })
      coaching = msg.content?.[0]?.text?.trim() || coaching
    } catch (err) { console.error('[nova-sales:log_call] Claude call failed:', err.message) }
  }

  await onInteraction(contact_id, 'sales', 'outbound', outcome_notes, sanitize(b.outcome, 60) || null)
  if (isSupabaseConfigured()) {
    await supabaseFetch('nova_crm_activities', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ contact_id, engine: 'sales_coach', direction: 'internal', summary: `Coaching: ${coaching}`, outcome: 'coached' }),
    }).catch(() => {})
  }
  return res.status(200).json({ ok: true, coaching })
}

// ============================================================ ACTION: get_coaching ============

async function handleGetCoaching(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch("nova_crm_activities?engine=eq.sales_coach&order=created_at.desc&limit=50")
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: generate_proposal =======

async function handleGenerateProposal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const contact_id = sanitize(b.contact_id, 100)
  if (!contact_id) return res.status(400).json({ error: 'contact_id is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const contactRes = await supabaseFetch(`nova_crm_contacts?id=eq.${contact_id}&limit=1`)
  const contact = contactRes.ok ? (await contactRes.json())[0] : null
  if (!contact) return res.status(404).json({ error: 'Contact not found' })

  let audit = null
  if (contact.audit_id) {
    const r = await supabaseFetch(`nova_ai_audits?id=eq.${contact.audit_id}&limit=1`)
    audit = r.ok ? (await r.json())[0] || null : null
  }

  const recommendedEngines = []
  if (audit?.phone_score < 70) recommendedEngines.push('Nova Voice')
  if (audit?.social_score < 70) recommendedEngines.push('Nova Social')
  if (audit?.google_score < 70) recommendedEngines.push('Nova Reviews')
  if (!recommendedEngines.length) recommendedEngines.push('Nova Blue', 'Nova Email')

  const proposal = {
    contact_id, business_name: contact.business_name, city: contact.city, industry: contact.industry,
    overall_score: audit?.overall_score ?? null, revenue_leak_monthly: audit?.revenue_leak_monthly ?? null,
    revenue_leak_annual: audit?.revenue_leak_annual ?? null, recommended_engines: recommendedEngines,
    investment: 'Wave One — $997/mo', generated_at: new Date().toISOString(),
  }

  await supabaseFetch('nova_documents', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ contact_id, document_type: 'proposal', title: `Proposal — ${contact.business_name}`, file_data: JSON.stringify(proposal) }),
  }).catch(() => {})
  await onInteraction(contact_id, 'sales', 'outbound', 'Generated a Nova Systems proposal', 'proposal_generated')

  return res.status(200).json({ ok: true, proposal })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Sales', ['ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'score_lead':        return await handleScoreLead(req, res)
      case 'get_prospects':     return await handleGetProspects(req, res)
      case 'generate_proposal': return await handleGenerateProposal(req, res)
      case 'log_call':          return await handleLogCall(req, res)
      case 'get_coaching':      return await handleGetCoaching(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Sales] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
