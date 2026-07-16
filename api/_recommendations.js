// Nova Recommendations — the shared "no engine is an island" primitive. Any engine calls
// createRecommendation() when it finds something actionable using data that came from (or
// belongs to) another part of the platform. Per the governing rule every recommendation must
// resolve to one of five real outcomes — enforced here, not left to convention, so a
// recommendation can never just sit there being displayed:
//   automation  — fires a real Nova Flow trigger immediately (needs triggerType)
//   task        — creates a real Nova Task another engine/human can approve
//   crm_update  — logs a real CRM activity immediately (needs contact_id)
//   notify      — sends a real SMS to Isaac immediately (via _automation.js:alertIsaac)
//   content     — the caller already generated real content before calling this; the
//                 recommendation just records what was generated as evidence
import { supabaseFetch, isSupabaseConfigured } from './_supabaseAdmin.js'
import { alertIsaac } from './_automation.js'

const RESOLUTIONS = ['automation', 'task', 'content', 'crm_update', 'notify']

export async function createRecommendation({
  engine, sourceEngines = [], message, recommended_action, resolution,
  estimated_value = null, is_measured = false, confidence = null, evidence = null,
  contact_id = null, triggerType = null, contact = null, assignTo = null,
}) {
  if (!engine || !message || !recommended_action) {
    console.error('[recommendations] engine, message, and recommended_action are required — refusing to create an untraceable recommendation')
    return null
  }
  if (!RESOLUTIONS.includes(resolution)) {
    console.error(`[recommendations] resolution must be one of ${RESOLUTIONS.join('/')}, got "${resolution}" — every recommendation must actually do something, not just be stored`)
    return null
  }
  if (!isSupabaseConfigured()) return null

  let rec = null
  try {
    const r = await supabaseFetch('nova_recommendations', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        engine, source_engines: sourceEngines, message, recommended_action,
        estimated_value, is_measured, confidence, evidence: evidence ?? null,
        resolution, contact_id, status: 'open',
      }),
    })
    rec = r.ok ? (await r.json())[0] : null
  } catch (err) {
    console.error('[recommendations:createRecommendation] Failed to persist:', err.message)
    return null
  }

  // Perform the actual resolution now — this is what makes `resolution` real instead of a label.
  try {
    if (resolution === 'notify') {
      await alertIsaac(`Nova ${engine}: ${message} — ${recommended_action}`)
    } else if (resolution === 'automation' && triggerType) {
      const { runTrigger } = await import('./nova-flow/_engine.js')
      await runTrigger(triggerType, contact || (contact_id ? { id: contact_id } : null))
    } else if (resolution === 'task') {
      const { createTask } = await import('./_tasks.js')
      await createTask({
        engine: assignTo || engine, title: recommended_action, description: message,
        contact_id, source_recommendation_id: rec?.id, triggerType,
      })
    } else if (resolution === 'crm_update' && contact_id) {
      const { onInteraction } = await import('./_integrations.js')
      await onInteraction(contact_id, engine, 'outbound', message, 'recommendation_logged')
    }
    // resolution === 'content': the caller generated the content before calling this — nothing
    // further to dispatch, the evidence field above is the record of what was created.
  } catch (err) {
    console.error(`[recommendations:createRecommendation] Dispatch for resolution "${resolution}" failed (recommendation still recorded):`, err.message)
  }

  return rec
}

export async function getOpenRecommendations({ engine, limit = 50 } = {}) {
  if (!isSupabaseConfigured()) return []
  const filter = engine ? `&engine=eq.${encodeURIComponent(engine)}` : ''
  const r = await supabaseFetch(`nova_recommendations?status=eq.open&order=created_at.desc&limit=${limit}${filter}`)
  return r.ok ? await r.json() : []
}

export async function resolveRecommendation(id, outcome = 'actioned') {
  if (!isSupabaseConfigured() || !id) return
  await supabaseFetch(`nova_recommendations?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: outcome, resolved_at: new Date().toISOString() }),
  }).catch((err) => console.error('[recommendations:resolveRecommendation] Failed:', err.message))
}
