import { setCors } from '../_cors.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { requireAuthenticatedUser } from '../_auth.js'
import { logEnvCheck } from '../_envCheck.js'

// Reuses the nova_ai_settings table already created by nova-systems.app in the same
// Supabase project — both apps share one set of third-party API keys for this business.
const SETTINGS_KEYS = ['GOOGLE_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'ELEVENLABS_API_KEY', 'DEEPGRAM_API_KEY']

// Returns only whether each key is set — never the value itself. These are live production
// credentials (Twilio auth token, ElevenLabs/Deepgram API keys); no API response, authenticated
// or not, should ever put them in the browser. Isaac re-enters a value to change it; a blank
// field just means "leave whatever is already configured alone."
async function handleGetSettings(req, res) {
  const user = await requireAuthenticatedUser(req, res)
  if (!user) return

  const configured = {}
  for (const key of SETTINGS_KEYS) configured[key] = !!process.env[key]
  if (isSupabaseConfigured()) {
    try {
      const r = await supabaseFetch(`nova_ai_settings?select=key,value&key=in.(${SETTINGS_KEYS.join(',')})`)
      if (r.ok) { for (const row of await r.json()) if (row.value) configured[row.key] = true }
    } catch (err) {
      console.error('[auth:get_settings] Error:', err.message)
    }
  }
  return res.status(200).json(configured)
}

async function handleSetSettings(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuthenticatedUser(req, res)
  if (!user) return
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const b = req.body || {}
  // Only ever write keys the caller actually sent a non-empty new value for — an empty string
  // must never overwrite (i.e. wipe) an already-configured credential.
  const updates = SETTINGS_KEYS
    .filter((k) => k in b && String(b[k] || '').trim().length > 0)
    .map((k) => ({ key: k, value: String(b[k]).trim(), updated_at: new Date().toISOString() }))
  if (!updates.length) return res.status(400).json({ error: 'No new values provided' })

  const r = await supabaseFetch('nova_ai_settings', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(updates),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to save settings' })
  return res.status(200).json({ ok: true, updated: updates.map((u) => u.key) })
}

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Auth', ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''
    switch (action) {
      case 'get_settings': return await handleGetSettings(req, res)
      case 'set_settings': return await handleSetSettings(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Auth] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
