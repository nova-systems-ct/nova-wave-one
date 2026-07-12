// Nova Hire — job postings, applications, AI screening, onboarding.
import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail, sanitizePhone } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { callClaude } from '../_agents.js'
import { alertIsaac } from '../_automation.js'

const POSTINGS = [
  { id: 'account_executive', title: 'Account Executive', compensation: 'Commission only', description: 'Sell Nova Systems Wave One to Connecticut small businesses. Full training provided.' },
  { id: 'content_creator', title: 'Content Creator', compensation: 'Contract', description: 'Create social content for Nova Systems and Wave One clients.' },
]

// ============================================================ ACTION: create_posting ==========
// Postings are a fixed in-code list for now (matches the two roles named in the spec); this
// action exists so the dashboard/API surface stays consistent if postings move to the DB later.

async function handleCreatePosting(req, res) {
  return res.status(200).json({ ok: true, postings: POSTINGS })
}

// ============================================================ ACTION: get_applications ========

async function handleGetApplications(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_hire_applications?order=created_at.desc&limit=200')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: submit_application ======
// Called from the public /careers/apply form.

async function handleSubmitApplication(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const name = sanitize(b.name, 100)
  const email = b.email ? sanitizeEmail(b.email) : null
  const position = sanitize(b.position, 100)
  if (!name || !email || !position) return res.status(400).json({ error: 'name, email, and position are required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch('nova_hire_applications', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      position, name, email, phone: b.phone ? sanitizePhone(b.phone) : null,
      cover_letter: sanitize(b.cover_letter, 5000), portfolio_url: sanitize(b.portfolio_url, 500), resume_url: sanitize(b.resume_url, 500),
      status: 'new',
    }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to submit application' })
  const application = (await r.json())[0]

  // Best-effort AI screening right away so Isaac sees a score before opening the application.
  handleScreenApplication({ body: { id: application.id } }, { status: () => ({ json: () => {} }) }).catch(() => {})
  await alertIsaac(`Nova Hire: new application from ${name} for ${position}.`).catch(() => {})

  return res.status(200).json({ ok: true, application })
}

// ============================================================ ACTION: screen_application =======

async function handleScreenApplication(req, res) {
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id || !isSupabaseConfigured()) return res?.status?.(400).json({ error: 'id is required' })

  const r = await supabaseFetch(`nova_hire_applications?id=eq.${encodeURIComponent(id)}&limit=1`)
  const application = r.ok ? (await r.json())[0] : null
  if (!application) return res?.status?.(404).json({ error: 'Application not found' })

  const systemPrompt = 'You screen job applications for Nova Systems. Return ONLY JSON: {"score": 0-100, "summary": "3 sentences covering relevant experience, communication quality, and enthusiasm"}.'
  const raw = await callClaude(systemPrompt, `Position: ${application.position}\nCover letter: ${application.cover_letter || '(none provided)'}\nPortfolio: ${application.portfolio_url || '(none)'}`, { maxTokens: 300, temperature: 0.4 })

  let score = null, summary = 'Screening unavailable — ANTHROPIC_API_KEY not configured.'
  if (raw) {
    try { const match = raw.match(/\{[\s\S]*\}/); const parsed = JSON.parse(match ? match[0] : raw); score = Math.max(0, Math.min(100, Number(parsed.score) || 0)); summary = parsed.summary || summary } catch { /* keep fallback */ }
  }

  await supabaseFetch(`nova_hire_applications?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ai_score: score, ai_summary: summary }) }).catch(() => {})
  return res?.status?.(200).json({ ok: true, score, summary })
}

// ============================================================ ACTION: create_onboarding =======
// Onboarding checklist is stored as an activity-style note on the application record — a
// dedicated table wasn't in the requested schema, so this keeps state visible without adding
// an unrequested table.

const ONBOARDING_TASKS = ['Sign NDA', 'Complete training', 'Set up accounts', 'Review SOPs']

async function handleCreateOnboarding(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  const r = await supabaseFetch(`nova_hire_applications?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'onboarding', ai_summary: `Onboarding checklist: ${ONBOARDING_TASKS.join(', ')}` }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to start onboarding' })
  return res.status(200).json({ ok: true, tasks: ONBOARDING_TASKS })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Hire', ['ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'create_posting':       return await handleCreatePosting(req, res)
      case 'get_applications':     return await handleGetApplications(req, res)
      case 'submit_application':   return await handleSubmitApplication(req, res)
      case 'screen_application':   return await handleScreenApplication(req, res)
      case 'create_onboarding':    return await handleCreateOnboarding(req, res)
      default:
        if (req.method === 'GET' && !action) return await handleGetApplications(req, res)
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Hire] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
