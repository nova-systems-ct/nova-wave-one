import { setCors } from '../_cors.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'

// Reuses the nova_ai_settings table already created by nova-systems.app in the same
// Supabase project — both apps share one set of third-party API keys for this business.
const SETTINGS_KEYS = ['GOOGLE_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'ELEVENLABS_API_KEY', 'DEEPGRAM_API_KEY']

async function handleGetSettings(req, res) {
  const map = {}
  for (const key of SETTINGS_KEYS) map[key] = process.env[key] || ''
  if (isSupabaseConfigured()) {
    try {
      const r = await supabaseFetch(`nova_ai_settings?select=key,value&key=in.(${SETTINGS_KEYS.join(',')})`)
      if (r.ok) { for (const row of await r.json()) if (row.value) map[row.key] = row.value }
    } catch (err) {
      console.error('[auth:get_settings] Error:', err.message)
    }
  }
  return res.status(200).json(map)
}

async function handleSetSettings(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })
  const b = req.body || {}
  const updates = SETTINGS_KEYS.filter((k) => k in b).map((k) => ({ key: k, value: String(b[k] || ''), updated_at: new Date().toISOString() }))
  if (!updates.length) return res.status(400).json({ error: 'No recognized settings keys provided' })

  const r = await supabaseFetch('nova_ai_settings', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(updates),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to save settings' })
  return res.status(200).json({ ok: true })
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''
  switch (action) {
    case 'get_settings': return handleGetSettings(req, res)
    case 'set_settings': return handleSetSettings(req, res)
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
