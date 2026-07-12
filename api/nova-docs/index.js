// Nova Docs — pitch decks (from audit data) and proposals (from CRM data), both stored in
// nova_documents with a shareable token. Reuses the existing pptx/pdf builders from Nova Audit.
import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import crypto from 'crypto'

function shareToken() { return crypto.randomBytes(12).toString('hex') }

// ============================================================ ACTION: generate_pitch_deck =====

async function handleGeneratePitchDeck(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const audit_id = sanitize(b.audit_id, 100)
  if (!audit_id || !isSupabaseConfigured()) return res.status(400).json({ error: 'audit_id is required' })

  const auditRes = await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(audit_id)}&limit=1`)
  const audit = auditRes.ok ? (await auditRes.json())[0] : null
  if (!audit) return res.status(404).json({ error: 'Audit not found' })

  let pitch_deck_data = audit.pitch_deck_data || null
  if (!pitch_deck_data) {
    try {
      const { buildPitchDeck } = await import('../nova-audit/_pptx.js')
      pitch_deck_data = await buildPitchDeck(audit)
    } catch (err) {
      console.error('[nova-docs:generate_pitch_deck] Build failed:', err.message)
      return res.status(500).json({ error: 'Failed to generate pitch deck' })
    }
  }

  const token = shareToken()
  const r = await supabaseFetch('nova_documents', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ contact_id: audit.id, document_type: 'pitch_deck', title: `Pitch Deck — ${audit.business_name}`, file_data: pitch_deck_data, share_token: token }),
  })
  const doc = r.ok ? (await r.json())[0] : null
  return res.status(200).json({ ok: true, document: doc, share_url: `/dashboard/docs/view/${token}` })
}

// ============================================================ ACTION: generate_proposal ========

async function handleGenerateProposal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const contact_id = sanitize(b.contact_id, 100)
  if (!contact_id || !isSupabaseConfigured()) return res.status(400).json({ error: 'contact_id is required' })

  const contactRes = await supabaseFetch(`nova_crm_contacts?id=eq.${encodeURIComponent(contact_id)}&limit=1`)
  const contact = contactRes.ok ? (await contactRes.json())[0] : null
  if (!contact) return res.status(404).json({ error: 'Contact not found' })

  let audit = null
  if (contact.audit_id) {
    const r = await supabaseFetch(`nova_ai_audits?id=eq.${contact.audit_id}&limit=1`)
    audit = r.ok ? (await r.json())[0] || null : null
  }

  let file_data = null
  try {
    const { buildAuditPdf } = await import('../nova-audit/_pdf.js')
    file_data = buildAuditPdf(audit || { business_name: contact.business_name, overall_score: 0, score_label: 'N/A', revenue_leak_monthly: 0, revenue_leak_annual: 0, key_findings: [] })
  } catch (err) {
    console.error('[nova-docs:generate_proposal] PDF build failed:', err.message)
  }

  const token = shareToken()
  const r = await supabaseFetch('nova_documents', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ contact_id, document_type: 'proposal', title: `Proposal — ${contact.business_name}`, file_data, share_token: token }),
  })
  const doc = r.ok ? (await r.json())[0] : null
  return res.status(200).json({ ok: true, document: doc, share_url: `/dashboard/docs/view/${token}` })
}

// ============================================================ ACTION: get_documents ============

async function handleGetDocuments(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const q = req.query || {}
  const filters = q.contact_id ? `&contact_id=eq.${encodeURIComponent(q.contact_id)}` : ''
  const r = await supabaseFetch(`nova_documents?select=id,contact_id,document_type,title,share_token,created_at&order=created_at.desc&limit=200${filters}`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Docs', ['SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'generate_pitch_deck': return await handleGeneratePitchDeck(req, res)
      case 'generate_proposal':   return await handleGenerateProposal(req, res)
      case 'get_documents':       return await handleGetDocuments(req, res)
      default:
        if (req.method === 'GET' && !action) return await handleGetDocuments(req, res)
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Docs] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
