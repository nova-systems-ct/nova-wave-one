// Nova CRM — the central brain every engine reads from and writes to. Contacts, activities
// (the cross-engine interaction timeline), and deals (pipeline).
import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail, sanitizePhone } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { getMemory } from '../_memory.js'
import { onNewContact, onInteraction } from '../_integrations.js'

const STATUSES = ['cold_lead', 'warm_lead', 'hot_lead', 'proposal_sent', 'negotiating', 'active_client', 'churned']

// ============================================================ ACTION: create_contact ========

async function handleCreateContact(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const business_name = sanitize(b.business_name, 200)
  if (!business_name) return res.status(400).json({ error: 'business_name is required' })

  const contact = await onNewContact({
    business_name,
    owner_name: sanitize(b.owner_name, 100),
    phone: b.phone ? sanitizePhone(b.phone) : null,
    email: b.email ? sanitizeEmail(b.email) : null,
    website: sanitize(b.website, 300),
    city: sanitize(b.city, 80),
    industry: sanitize(b.industry, 80),
    source: sanitize(b.source, 60) || 'manual',
    status: STATUSES.includes(b.status) ? b.status : 'cold_lead',
    deal_value: Number(b.deal_value) || 0,
  })
  if (!contact) return res.status(500).json({ error: 'Failed to create contact' })
  return res.status(200).json({ ok: true, contact })
}

// ============================================================ ACTION: update_contact ========

async function handleUpdateContact(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const patch = { updated_at: new Date().toISOString() }
  for (const key of ['business_name', 'owner_name', 'website', 'city', 'industry', 'source', 'notes']) {
    if (key in b) patch[key] = sanitize(b[key], 2000)
  }
  if ('phone' in b) patch.phone = b.phone ? sanitizePhone(b.phone) : null
  if ('email' in b) patch.email = b.email ? sanitizeEmail(b.email) : null
  if ('status' in b && STATUSES.includes(b.status)) patch.status = b.status
  if ('lead_score' in b) patch.lead_score = Math.max(0, Math.min(100, Number(b.lead_score) || 0))
  if ('deal_value' in b) patch.deal_value = Number(b.deal_value) || 0

  const r = await supabaseFetch(`nova_crm_contacts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  })
  if (!r.ok) return res.status(500).json({ error: 'Update failed' })
  return res.status(200).json({ ok: true })
}

// ============================================================ ACTION: get_contact ===========

async function handleGetContact(req, res) {
  const id = sanitize(req.query?.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isSupabaseConfigured()) return res.status(404).json(null)

  const [contactRes, activitiesRes, dealsRes, memory] = await Promise.all([
    supabaseFetch(`nova_crm_contacts?id=eq.${encodeURIComponent(id)}&limit=1`),
    supabaseFetch(`nova_crm_activities?contact_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=200`),
    supabaseFetch(`nova_crm_deals?contact_id=eq.${encodeURIComponent(id)}&order=created_at.desc`),
    getMemory({ contactId: id }),
  ])
  const contact = contactRes.ok ? (await contactRes.json())[0] : null
  if (!contact) return res.status(404).json(null)
  const activities = activitiesRes.ok ? await activitiesRes.json() : []
  const deals = dealsRes.ok ? await dealsRes.json() : []

  // Pull the matching audit record too, if one exists, so the contact detail page can show
  // full audit history without a second round trip from the frontend.
  let audit = null
  if (contact.audit_id) {
    const auditRes = await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(contact.audit_id)}&limit=1`)
    audit = auditRes.ok ? (await auditRes.json())[0] || null : null
  } else if (contact.phone || contact.email) {
    const filters = []
    if (contact.phone) filters.push(`phone.eq.${encodeURIComponent(contact.phone)}`)
    if (contact.email) filters.push(`email.eq.${encodeURIComponent(contact.email)}`)
    const auditRes = await supabaseFetch(`nova_ai_audits?or=(${filters.join(',')})&order=created_at.desc&limit=1`)
    audit = auditRes.ok ? (await auditRes.json())[0] || null : null
  }

  return res.status(200).json({ contact, activities, deals, memory, audit })
}

// ============================================================ ACTION: get_contacts ==========

async function handleGetContacts(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const q = req.query || {}
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 100))
  const offset = (page - 1) * limit
  const filters = []
  if (q.status) filters.push(`status=eq.${encodeURIComponent(q.status)}`)
  if (q.search) {
    const s = encodeURIComponent(q.search)
    filters.push(`or=(business_name.ilike.*${s}*,owner_name.ilike.*${s}*,email.ilike.*${s}*,phone.ilike.*${s}*)`)
  }
  const query = filters.length ? `&${filters.join('&')}` : ''
  const r = await supabaseFetch(`nova_crm_contacts?order=updated_at.desc&limit=${limit}&offset=${offset}${query}`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: log_activity ==========

async function handleLogActivity(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const contact_id = sanitize(b.contact_id, 100)
  const engine = sanitize(b.engine, 40)
  const direction = sanitize(b.direction, 20)
  const summary = sanitize(b.summary, 2000)
  if (!contact_id || !engine) return res.status(400).json({ error: 'contact_id and engine are required' })

  await onInteraction(contact_id, engine, direction || 'outbound', summary, sanitize(b.outcome, 60) || null)
  return res.status(200).json({ ok: true })
}

// ============================================================ ACTION: create_deal ===========

async function handleCreateDeal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const contact_id = sanitize(b.contact_id, 100)
  const title = sanitize(b.title, 200)
  if (!contact_id || !title) return res.status(400).json({ error: 'contact_id and title are required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch('nova_crm_deals', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      contact_id, title,
      stage: sanitize(b.stage, 40) || 'prospect',
      value: Number(b.value) || 0,
      probability: Math.max(0, Math.min(100, Number(b.probability) || 0)),
      expected_close: b.expected_close || null,
    }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to create deal' })
  const rows = await r.json()
  return res.status(200).json({ ok: true, deal: rows[0] })
}

// ============================================================ ACTION: update_deal ===========

async function handleUpdateDeal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const patch = {}
  if ('title' in b) patch.title = sanitize(b.title, 200)
  if ('stage' in b) patch.stage = sanitize(b.stage, 40)
  if ('value' in b) patch.value = Number(b.value) || 0
  if ('probability' in b) patch.probability = Math.max(0, Math.min(100, Number(b.probability) || 0))
  if ('expected_close' in b) patch.expected_close = b.expected_close || null

  const r = await supabaseFetch(`nova_crm_deals?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  })
  if (!r.ok) return res.status(500).json({ error: 'Update failed' })
  return res.status(200).json({ ok: true })
}

// ============================================================ ACTION: get_pipeline ==========
// Kanban view — contacts grouped by status, each with its highest-value open deal attached.

async function handleGetPipeline(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json(Object.fromEntries(STATUSES.map((s) => [s, []])))

  const [contactsRes, dealsRes] = await Promise.all([
    supabaseFetch('nova_crm_contacts?order=updated_at.desc&limit=500'),
    supabaseFetch('nova_crm_deals?order=value.desc&limit=1000'),
  ])
  const contacts = contactsRes.ok ? await contactsRes.json() : []
  const deals = dealsRes.ok ? await dealsRes.json() : []
  const dealsByContact = {}
  for (const d of deals) { if (!dealsByContact[d.contact_id]) dealsByContact[d.contact_id] = d }

  const grouped = Object.fromEntries(STATUSES.map((s) => [s, []]))
  for (const c of contacts) {
    const status = STATUSES.includes(c.status) ? c.status : 'cold_lead'
    grouped[status].push({ ...c, top_deal: dealsByContact[c.id] || null })
  }
  return res.status(200).json(grouped)
}

// ============================================================ ACTION: get_alerts ============
// Contacts that need attention today: no activity in 7+ days, or a proposal sent 5+ days ago.

async function handleGetAlerts(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch("nova_crm_contacts?status=neq.churned&status=neq.active_client&order=updated_at.asc&limit=500")
  const contacts = r.ok ? await r.json() : []
  const now = Date.now()
  const alerts = []
  for (const c of contacts) {
    const daysSinceUpdate = (now - new Date(c.updated_at).getTime()) / 86400000
    if (c.status === 'proposal_sent' && daysSinceUpdate >= 5) {
      alerts.push({ contact: c, reason: `Proposal sent ${Math.floor(daysSinceUpdate)} days ago with no response`, severity: 'high' })
    } else if (daysSinceUpdate >= 7) {
      alerts.push({ contact: c, reason: `No activity in ${Math.floor(daysSinceUpdate)} days`, severity: daysSinceUpdate >= 14 ? 'high' : 'medium' })
    }
  }
  return res.status(200).json(alerts.slice(0, 50))
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova CRM', ['SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'create_contact': return await handleCreateContact(req, res)
      case 'update_contact': return await handleUpdateContact(req, res)
      case 'get_contact':    return await handleGetContact(req, res)
      case 'get_contacts':   return await handleGetContacts(req, res)
      case 'log_activity':   return await handleLogActivity(req, res)
      case 'create_deal':    return await handleCreateDeal(req, res)
      case 'update_deal':    return await handleUpdateDeal(req, res)
      case 'get_pipeline':   return await handleGetPipeline(req, res)
      case 'get_alerts':     return await handleGetAlerts(req, res)
      default:
        if (req.method === 'GET' && !action) return await handleGetContacts(req, res)
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova CRM] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
