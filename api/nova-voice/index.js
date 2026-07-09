import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'

async function handleGetAgents(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_agents?order=created_at.desc')
  return res.status(200).json(r.ok ? await r.json() : [])
}

async function handleGetAgent(req, res) {
  const id = sanitize(req.query?.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isSupabaseConfigured()) return res.status(404).json(null)
  const r = await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(id)}&limit=1`)
  const rows = r.ok ? await r.json() : []
  return res.status(200).json(rows[0] || null)
}

async function handleCreateAgent(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const agent_name = sanitize(b.agent_name, 100) || 'Nova'
  const business_name = sanitize(b.business_name, 200)
  if (!business_name) return res.status(400).json({ error: 'business_name is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch('nova_ai_agents', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ agent_name, business_name, status: 'testing' }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to create agent' })
  const rows = await r.json()
  return res.status(200).json({ ok: true, agent: rows[0] })
}

async function handleGetVoices(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_voices?order=created_at.asc')
  return res.status(200).json(r.ok ? await r.json() : [])
}

async function handleGetCalls(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_calls?order=created_at.desc&limit=100')
  return res.status(200).json(r.ok ? await r.json() : [])
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''

  switch (action) {
    case 'get_agents':   return handleGetAgents(req, res)
    case 'get_agent':    return handleGetAgent(req, res)
    case 'create_agent': return handleCreateAgent(req, res)
    case 'get_voices':   return handleGetVoices(req, res)
    case 'get_calls':    return handleGetCalls(req, res)
    default:
      if (req.method === 'GET' && !action) return handleGetAgents(req, res)
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
