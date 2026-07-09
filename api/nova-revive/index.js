import { setCors } from '../_cors.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'

// Leads that never responded after the full Nova Audit outreach sequence (email day 1/3,
// SMS day 7, voice day 10, social day 14) land here for ongoing monthly check-ins.
async function handleGetQueue(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch("nova_ai_audits?outreach_status=eq.no_response&order=created_at.desc")
  return res.status(200).json(r.ok ? await r.json() : [])
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''
  switch (action) {
    case 'get_queue': return handleGetQueue(req, res)
    default:
      if (req.method === 'GET' && !action) return handleGetQueue(req, res)
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
