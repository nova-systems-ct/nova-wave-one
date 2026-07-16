import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { ensureDefaultWorkflows, runTrigger, processPendingSteps } from './_engine.js'

const TRIGGER_TYPES = ['new_lead', 'audit_complete', 'meeting_booked', 'meeting_cancelled', 'no_show', 'payment_received', 'review_received', 'lead_went_cold', 'client_churned', 'manual']
const ACTION_TYPES = ['send_sms', 'send_email', 'send_whatsapp', 'make_call', 'create_crm_activity', 'update_lead_status', 'send_notification_to_isaac', 'wait', 'run_audit', 'generate_proposal']

async function handleGetWorkflows(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  await ensureDefaultWorkflows()
  const r = await supabaseFetch('nova_flow_workflows?order=created_at.desc')
  return res.status(200).json(r.ok ? await r.json() : [])
}

async function handleCreateWorkflow(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const name = sanitize(b.name, 200)
  if (!name || !TRIGGER_TYPES.includes(b.trigger_type)) return res.status(400).json({ error: 'name and a valid trigger_type are required' })
  const actions = Array.isArray(b.actions) ? b.actions.filter((a) => ACTION_TYPES.includes(a.type)) : []
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch('nova_flow_workflows', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, trigger_type: b.trigger_type, trigger_conditions: b.trigger_conditions || {}, actions, active: true }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to create workflow' })
  return res.status(200).json({ ok: true, workflow: (await r.json())[0] })
}

async function handleToggleWorkflow(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  const r = await supabaseFetch(`nova_flow_workflows?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ active: !!b.active }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Toggle failed' })
  return res.status(200).json({ ok: true })
}

async function handleGetRuns(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_flow_runs?order=started_at.desc&limit=100')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// Lets any engine (or a manual dashboard action) fire a trigger over HTTP instead of importing
// _engine.js directly — mainly useful for testing a workflow without waiting for the real event.
async function handleTrigger(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  if (!TRIGGER_TYPES.includes(b.trigger_type)) return res.status(400).json({ error: 'A valid trigger_type is required' })
  const result = await runTrigger(b.trigger_type, b.contact || null)
  return res.status(200).json({ ok: true, ...result })
}

// Cron entry point (see vercel.json) — resumes any workflow `wait` steps whose delay has elapsed.
async function handleProcessPending(req, res) {
  const result = await processPendingSteps()
  return res.status(200).json({ ok: true, ...result })
}

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Flow', ['SUPABASE_SERVICE_ROLE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'get_workflows':    return await handleGetWorkflows(req, res)
      case 'create_workflow':  return await handleCreateWorkflow(req, res)
      case 'toggle_workflow':  return await handleToggleWorkflow(req, res)
      case 'get_runs':         return await handleGetRuns(req, res)
      case 'trigger':          return await handleTrigger(req, res)
      case 'process_pending':  return await handleProcessPending(req, res)
      default:
        if (req.method === 'GET' && !action) return await handleGetWorkflows(req, res)
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Flow] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
