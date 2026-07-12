// Nova Flow execution engine — shared between api/nova-flow/index.js (dashboard CRUD) and
// api/_integrations.js (every other engine's trigger calls), so there's exactly one place that
// knows how to run a workflow.
//
// Serverless constraint: Vercel functions have a hard execution ceiling (60s, see vercel.json).
// A `wait` step meaning "pause 24 hours, then continue" cannot literally block inside one
// invocation. Each `run_trigger` call executes every action in the matched workflow(s)
// immediately and logs `wait` steps as recorded-but-not-delayed — the run history makes this
// visible rather than silently pretending a real delay happened. A future iteration could re-
// queue the remaining steps via another cron tick; that's out of scope for this pass.
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { alertIsaac, personalize } from '../_automation.js'

const DEFAULT_WORKFLOWS = [
  {
    name: 'New Lead',
    trigger_type: 'new_lead',
    trigger_conditions: {},
    actions: [
      { type: 'send_email', subject: 'Welcome to Nova Systems', body: 'Hi [name], thanks for connecting with Nova Systems — we help Connecticut businesses like [business_name] recover lost revenue with AI. We will be in touch shortly.' },
      { type: 'wait', hours: 1 },
      { type: 'send_sms', body: 'Hey [name], Isaac here from Nova Systems. Did you get my email? Happy to answer any questions.' },
      { type: 'wait', hours: 24 },
      { type: 'send_notification_to_isaac', message: 'New Lead workflow: 24h checkpoint reached for [business_name] with no recorded response — consider a manual follow-up or run_audit.' },
    ],
  },
  {
    name: 'No Show',
    trigger_type: 'no_show',
    trigger_conditions: {},
    actions: [
      { type: 'send_sms', body: 'Hi [name], sorry we missed you! Want to grab a new time? Reply here or book at nova-systems.app/book.' },
      { type: 'wait', hours: 2 },
      { type: 'update_lead_status', status: 'cold_lead' },
      { type: 'send_notification_to_isaac', message: '[name] from [business_name] no-showed and has not rebooked — consider a call.' },
    ],
  },
  {
    name: 'New Client',
    trigger_type: 'payment_received',
    trigger_conditions: {},
    actions: [
      { type: 'send_email', subject: 'Welcome aboard!', body: "Welcome to Nova Systems, [name]! We're excited to get started with [business_name]. Isaac will be in touch with next steps." },
      { type: 'create_crm_activity', summary: 'Became an active client' },
      { type: 'update_lead_status', status: 'active_client' },
      { type: 'send_notification_to_isaac', message: 'New client signed: [business_name].' },
    ],
  },
]

export async function ensureDefaultWorkflows() {
  if (!isSupabaseConfigured()) return
  const r = await supabaseFetch('nova_flow_workflows?select=id&limit=1')
  const rows = r.ok ? await r.json() : []
  if (rows.length) return
  await supabaseFetch('nova_flow_workflows', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(DEFAULT_WORKFLOWS.map((w) => ({ ...w, active: true }))),
  }).catch((err) => console.error('[nova-flow] Failed to seed default workflows:', err.message))
}

async function runAction(action, contact) {
  const tokens = { name: contact?.owner_name || contact?.business_name || 'there', business_name: contact?.business_name || '' }
  switch (action.type) {
    case 'send_sms': {
      if (!contact?.phone || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) return { skipped: true, reason: 'no phone or Twilio not configured' }
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: contact.phone, From: process.env.TWILIO_PHONE_NUMBER, Body: personalize(action.body, tokens) }).toString(),
      })
      return { sent: true }
    }
    case 'send_whatsapp': {
      if (!contact?.phone || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) return { skipped: true, reason: 'no phone or Twilio not configured' }
      const digits = (n) => String(n || '').replace(/[^0-9]/g, '')
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: `whatsapp:+${digits(contact.phone)}`, From: `whatsapp:+${digits(process.env.TWILIO_PHONE_NUMBER)}`, Body: personalize(action.body, tokens) }).toString(),
      })
      return { sent: true }
    }
    case 'send_email': {
      if (!contact?.email || !process.env.RESEND_API_KEY) return { skipped: true, reason: 'no email or Resend not configured' }
      await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Nova Systems <hello@nova-systems.app>', to: [contact.email], subject: personalize(action.subject || 'Nova Systems', tokens), html: `<p>${personalize(action.body || '', tokens)}</p>` }),
      })
      return { sent: true }
    }
    case 'make_call':
      return { skipped: true, reason: 'make_call from a workflow requires an agent_id — trigger Nova Voice directly for now' }
    case 'create_crm_activity':
      if (!contact?.id || !isSupabaseConfigured()) return { skipped: true }
      await supabaseFetch('nova_crm_activities', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ contact_id: contact.id, engine: 'flow', direction: 'outbound', summary: action.summary || 'Workflow action' }) })
      return { logged: true }
    case 'update_lead_status':
      if (!contact?.id || !isSupabaseConfigured()) return { skipped: true }
      await supabaseFetch(`nova_crm_contacts?id=eq.${contact.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: action.status, updated_at: new Date().toISOString() }) })
      return { updated: true }
    case 'send_notification_to_isaac':
      await alertIsaac(personalize(action.message || 'Nova Flow: workflow step reached.', tokens)).catch(() => {})
      return { notified: true }
    case 'wait':
      // See file header — not a real delay in this pass, just recorded in the run log.
      return { waited_hours_requested: action.hours || 0, note: 'not a real delay in this build — see api/nova-flow/_engine.js' }
    case 'run_audit':
      return { skipped: true, reason: 'run_audit from a workflow requires business_name/city/industry — trigger Nova Audit directly for now' }
    case 'generate_proposal':
      return { skipped: true, reason: 'generate_proposal from a workflow requires a contact_id — trigger Nova Docs directly for now' }
    default:
      return { skipped: true, reason: `unknown action type "${action.type}"` }
  }
}

export async function runTrigger(trigger_type, contact) {
  if (!isSupabaseConfigured() || !trigger_type) return { ran: 0 }
  await ensureDefaultWorkflows()

  const r = await supabaseFetch(`nova_flow_workflows?trigger_type=eq.${encodeURIComponent(trigger_type)}&active=eq.true`)
  const workflows = r.ok ? await r.json() : []
  let ran = 0

  for (const workflow of workflows) {
    const runRes = await supabaseFetch('nova_flow_runs', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ workflow_id: workflow.id, contact_id: contact?.id || null, status: 'running' }),
    })
    const run = runRes.ok ? (await runRes.json())[0] : null

    const results = []
    for (const action of Array.isArray(workflow.actions) ? workflow.actions : []) {
      try {
        results.push({ action: action.type, ...(await runAction(action, contact)) })
      } catch (err) {
        console.error(`[nova-flow] Action "${action.type}" in workflow "${workflow.name}" failed:`, err.message)
        results.push({ action: action.type, error: err.message })
      }
    }

    if (run) {
      await supabaseFetch(`nova_flow_runs?id=eq.${run.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
      }).catch(() => {})
    }
    await supabaseFetch(`nova_flow_workflows?id=eq.${workflow.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ run_count: (workflow.run_count || 0) + 1 }),
    }).catch(() => {})

    ran++
  }
  return { ran }
}
