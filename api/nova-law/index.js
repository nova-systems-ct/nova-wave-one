// Nova Law — contract templates, e-signatures, license tracking, compliance checklist.
// Legal organization, not legal advice.
import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'

const TEMPLATES = {
  wave_one_service_agreement: 'Wave One Service Agreement\n\nThis agreement is between Nova Systems ("Provider") and [client_name] ("Client") for AI automation services beginning [date]. Provider will deliver the Wave One platform including the engines specified in the attached proposal. Client agrees to a monthly fee of $[amount], billed automatically. Either party may terminate with 30 days written notice.',
  website_development_agreement: 'Website Development Agreement\n\nNova Systems will design and develop a website for [client_name] per the agreed scope. Project fee: $[amount]. Client will provide content and feedback within agreed timelines. Ownership transfers to Client upon final payment.',
  social_media_management_agreement: 'Social Media Management Agreement\n\nNova Systems will manage social media accounts for [client_name] including content creation, scheduling, and engagement. Monthly fee: $[amount]. Client retains ownership of all accounts and content.',
  white_label_partnership_agreement: 'White Label Partnership Agreement\n\nThis agreement establishes a white-label reseller relationship between Nova Systems and [client_name] for Wave One services under [client_name]\'s own branding, per the attached commercial terms.',
}

const COMPLIANCE_ITEMS = [
  { id: 'tcpa', label: 'TCPA compliance for SMS', check: 'Every SMS engine checks opt-out status and STOP handling before sending (see api/_automation.js).' },
  { id: 'can_spam', label: 'CAN-SPAM for email', check: 'Every campaign email includes an unsubscribe link and physical business identification.' },
  { id: 'gdpr', label: 'GDPR basics for data collection', check: 'Contact data is only collected with a clear source and is never sold to third parties.' },
  { id: 'ct_business', label: 'Connecticut business requirements', check: 'Business registration and any required local licenses — track renewal dates in License Tracker.' },
]

// ============================================================ ACTION: create_contract =========

async function handleCreateContract(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const contract_type = TEMPLATES[b.contract_type] ? b.contract_type : null
  if (!contract_type) return res.status(400).json({ error: `contract_type must be one of: ${Object.keys(TEMPLATES).join(', ')}` })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  let content = TEMPLATES[contract_type]
  for (const [key, val] of Object.entries(b.fields || {})) content = content.replaceAll(`[${key}]`, String(val))

  const r = await supabaseFetch('nova_law_contracts', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ contact_id: sanitize(b.contact_id, 100) || null, contract_type, content, signed: false }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to create contract' })
  return res.status(200).json({ ok: true, contract: (await r.json())[0] })
}

// ============================================================ ACTION: sign_contract ============

async function handleSignContract(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  const signature_data = typeof b.signature_data === 'string' ? b.signature_data.slice(0, 500000) : null
  if (!id || !signature_data) return res.status(400).json({ error: 'id and signature_data are required' })

  const r = await supabaseFetch(`nova_law_contracts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ signed: true, signature_data, signed_at: new Date().toISOString() }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Sign failed' })
  return res.status(200).json({ ok: true })
}

// ============================================================ ACTION: get_contracts ============

async function handleGetContracts(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_law_contracts?order=created_at.desc&limit=200')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: get_licenses =============

async function handleGetLicenses(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_law_licenses?order=expiry_date.asc.nullslast')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: get_compliance ===========

async function handleGetCompliance(req, res) {
  return res.status(200).json(COMPLIANCE_ITEMS)
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Law', ['SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'create_contract': return await handleCreateContract(req, res)
      case 'sign_contract':   return await handleSignContract(req, res)
      case 'get_contracts':   return await handleGetContracts(req, res)
      case 'get_licenses':    return await handleGetLicenses(req, res)
      case 'get_compliance':  return await handleGetCompliance(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Law] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
