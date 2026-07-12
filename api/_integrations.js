// Cross-engine integration hooks — every engine calls these at the moments described so Nova
// CRM, Nova Memory, and Nova Flow stay in sync automatically without each engine re-implementing
// "also update the CRM" / "also check memory" logic. Server-side only (service-role key).
import { supabaseFetch, isSupabaseConfigured } from './_supabaseAdmin.js'
import { updateMemory } from './_memory.js'
import { alertIsaac } from './_automation.js'

async function findContactByPhoneOrEmail(phone, email) {
  if (!isSupabaseConfigured() || (!phone && !email)) return null
  const filters = []
  if (phone) filters.push(`phone.eq.${encodeURIComponent(phone)}`)
  if (email) filters.push(`email.eq.${encodeURIComponent(email)}`)
  const r = await supabaseFetch(`nova_crm_contacts?or=(${filters.join(',')})&limit=1`)
  const rows = r.ok ? await r.json() : []
  return rows[0] || null
}

// Fires a Nova Flow workflow matching trigger_type — best-effort, never throws, since a flow
// failure should never block the engine action that triggered it.
async function fireFlow(trigger_type, contact) {
  if (!isSupabaseConfigured()) return
  try {
    await supabaseFetch('nova_flow_runs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ workflow_id: null, contact_id: contact?.id || null, status: `queued:${trigger_type}` }),
    })
    // The actual workflow lookup/execution lives in api/nova-flow — call it directly so this
    // stays a single round trip instead of every engine needing to know Nova Flow's URL shape.
    const { runTrigger } = await import('./nova-flow/_engine.js')
    await runTrigger(trigger_type, contact)
  } catch (err) {
    console.error(`[integrations:fireFlow] ${trigger_type} failed (non-fatal):`, err.message)
  }
}

// Called whenever any engine encounters a person/business it hasn't seen before (a new audit,
// a new inbound message from an unknown number, a new booking, etc).
export async function onNewContact(contact_data = {}) {
  if (!isSupabaseConfigured()) return null
  try {
    const existing = await findContactByPhoneOrEmail(contact_data.phone, contact_data.email)
    let contact = existing
    if (!existing) {
      const r = await supabaseFetch('nova_crm_contacts', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          business_name: contact_data.business_name || null,
          owner_name: contact_data.owner_name || null,
          phone: contact_data.phone || null,
          email: contact_data.email || null,
          website: contact_data.website || null,
          city: contact_data.city || null,
          industry: contact_data.industry || null,
          source: contact_data.source || 'unknown',
          status: contact_data.status || 'cold_lead',
          deal_value: contact_data.deal_value || 0,
          audit_id: contact_data.audit_id || null,
        }),
      })
      const rows = r.ok ? await r.json() : []
      contact = rows[0] || null
    }
    if (contact) {
      await updateMemory({ contactId: contact.id, phone: contact.phone, email: contact.email }, {})
      await fireFlow('new_lead', contact)
    }
    return contact
  } catch (err) {
    console.error('[integrations:onNewContact] Failed:', err.message)
    return null
  }
}

// Called after every single interaction on every channel — this is what makes Nova CRM's
// activity timeline and Nova Memory's personalization actually populate automatically.
export async function onInteraction(contact_id, engine, direction, summary, outcome) {
  if (!isSupabaseConfigured() || !contact_id) return
  try {
    await supabaseFetch('nova_crm_activities', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ contact_id, engine, direction, summary, outcome: outcome || null }),
    })
    await supabaseFetch(`nova_crm_contacts?id=eq.${contact_id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    })
    await updateMemory({ contactId: contact_id }, {
      last_topic_discussed: summary || null,
      newTopic: summary || null,
      respondedOk: direction === 'inbound' ? true : undefined,
    })
  } catch (err) {
    console.error('[integrations:onInteraction] Failed:', err.message)
  }
}

// Called by Nova Book right after a meeting is saved.
export async function onMeetingBooked(contact_id, meeting_data = {}) {
  if (!isSupabaseConfigured()) return
  try {
    if (contact_id) {
      await supabaseFetch(`nova_crm_contacts?id=eq.${contact_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'warm_lead', updated_at: new Date().toISOString() }),
      })
      await updateMemory({ contactId: contact_id }, { incrementAppointments: true })
      await onInteraction(contact_id, 'book', 'outbound', `Booked ${meeting_data.meeting_type || 'a meeting'}`, 'booked')
    }
    const contact = contact_id ? { id: contact_id } : null
    await fireFlow('meeting_booked', contact)
  } catch (err) {
    console.error('[integrations:onMeetingBooked] Failed:', err.message)
  }
}

// Called by Nova Finances when a Stripe payment webhook confirms an invoice was paid.
export async function onPaymentReceived(contact_id, amount) {
  if (!isSupabaseConfigured()) return
  try {
    if (contact_id) {
      await supabaseFetch(`nova_crm_contacts?id=eq.${contact_id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'active_client', updated_at: new Date().toISOString() }),
      })
      await onInteraction(contact_id, 'finances', 'inbound', `Payment received: $${Number(amount || 0).toLocaleString()}`, 'paid')
    }
    await fireFlow('payment_received', contact_id ? { id: contact_id } : null)
    await alertIsaac(`Nova Finances: payment received — $${Number(amount || 0).toLocaleString()}. Check dashboard.`).catch(() => {})
  } catch (err) {
    console.error('[integrations:onPaymentReceived] Failed:', err.message)
  }
}

// Called by Nova Revive (or any engine) when a lead has gone quiet long enough to need
// escalation beyond Revive's own automatic channel-rotation.
export async function onLeadWentCold(contact_id) {
  if (!isSupabaseConfigured() || !contact_id) return
  try {
    const r = await supabaseFetch(`nova_crm_contacts?id=eq.${contact_id}&limit=1`)
    const contact = r.ok ? (await r.json())[0] : null
    await supabaseFetch(`nova_crm_contacts?id=eq.${contact_id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'cold_lead', updated_at: new Date().toISOString() }),
    })
    await alertIsaac(`Nova CRM: ${contact?.business_name || 'a lead'} has gone cold — no response despite outreach. Check dashboard.`).catch(() => {})
  } catch (err) {
    console.error('[integrations:onLeadWentCold] Failed:', err.message)
  }
}
