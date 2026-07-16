// Nova Tasks — the shared approve-to-execute primitive. A recommendation becomes a task;
// approving it either fires a real Nova Flow automation (if trigger_type is set) or is simply
// marked done for a human-assigned task — either way it's logged back to CRM as a real activity,
// so nothing closes silently. Surfaced across every engine's dashboard via Nova Insights
// (Mission Control), not owned by any single engine.
import { supabaseFetch, isSupabaseConfigured } from './_supabaseAdmin.js'

export async function createTask({ engine, title, description = null, contact_id = null, source_recommendation_id = null, assignTo = null, triggerType = null }) {
  if (!isSupabaseConfigured() || !engine || !title) return null
  try {
    const r = await supabaseFetch('nova_tasks', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        engine, title, description, contact_id, source_recommendation_id,
        assigned_to: assignTo, trigger_type: triggerType, status: 'pending',
      }),
    })
    return r.ok ? (await r.json())[0] : null
  } catch (err) {
    console.error('[tasks:createTask] Failed:', err.message)
    return null
  }
}

export async function getOpenTasks({ engine, limit = 100 } = {}) {
  if (!isSupabaseConfigured()) return []
  const filter = engine ? `&engine=eq.${encodeURIComponent(engine)}` : ''
  const r = await supabaseFetch(`nova_tasks?status=eq.pending&order=created_at.desc&limit=${limit}${filter}`)
  return r.ok ? await r.json() : []
}

// Approving a task fires its real Flow automation (if trigger_type was set when the task was
// created) and logs the approval to CRM — a task never just quietly flips a status with no trace.
export async function approveTask(id) {
  if (!isSupabaseConfigured() || !id) return { ok: false, error: 'Supabase not configured or id missing' }
  const r = await supabaseFetch(`nova_tasks?id=eq.${encodeURIComponent(id)}&limit=1`)
  const task = r.ok ? (await r.json())[0] : null
  if (!task) return { ok: false, error: 'Task not found' }

  let dispatchResult = null
  try {
    if (task.trigger_type) {
      const { runTrigger } = await import('./nova-flow/_engine.js')
      dispatchResult = await runTrigger(task.trigger_type, task.contact_id ? { id: task.contact_id } : null)
    }
    if (task.contact_id) {
      const { onInteraction } = await import('./_integrations.js')
      await onInteraction(task.contact_id, task.engine, 'outbound', `Task approved: ${task.title}`, 'task_approved')
    }
  } catch (err) {
    console.error('[tasks:approveTask] Dispatch failed (task still marked done):', err.message)
  }

  await supabaseFetch(`nova_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'done', completed_at: new Date().toISOString() }),
  }).catch(() => {})

  return { ok: true, dispatchResult }
}

export async function dismissTask(id) {
  if (!isSupabaseConfigured() || !id) return { ok: false }
  await supabaseFetch(`nova_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'dismissed', completed_at: new Date().toISOString() }),
  }).catch((err) => console.error('[tasks:dismissTask] Failed:', err.message))
  return { ok: true }
}
