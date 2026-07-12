// Nova Memory — the permanent per-contact personalization layer every engine reads before
// acting and writes after acting. Server-side only (uses the service-role key via
// supabaseFetch), matching every other cross-engine helper in this folder — there is no
// client-side equivalent with write access, since that would require shipping the service
// role key to the browser.
import { supabaseFetch, isSupabaseConfigured } from './_supabaseAdmin.js'

// Looks up a memory row by phone or email — whichever is provided. Contacts are matched by
// contact info rather than requiring every caller to already know a nova_crm_contacts id,
// since engines like Nova SMS/Email only ever see a phone number or email address directly.
export async function getMemory({ contactId, phone, email } = {}) {
  if (!isSupabaseConfigured()) return null
  try {
    let query = ''
    if (contactId) query = `contact_id=eq.${encodeURIComponent(contactId)}`
    else if (phone) query = `contact_phone=eq.${encodeURIComponent(phone)}`
    else if (email) query = `contact_email=eq.${encodeURIComponent(email)}`
    else return null

    const r = await supabaseFetch(`nova_memory?${query}&limit=1`)
    const rows = r.ok ? await r.json() : []
    return rows[0] || null
  } catch (err) {
    console.error('[memory:getMemory] Failed:', err.message)
    return null
  }
}

export async function getPreferredChannel({ contactId, phone, email } = {}, fallback = 'sms') {
  const mem = await getMemory({ contactId, phone, email })
  return mem?.preferred_channel || fallback
}

export async function getPreferredLanguage({ contactId, phone, email } = {}, fallback = 'en') {
  const mem = await getMemory({ contactId, phone, email })
  return mem?.preferred_language || fallback
}

// Creates the memory row if none exists for this contact, or merges new fields into the
// existing one. `patch` fields:
//   preferred_language, preferred_channel, best_time_to_contact, sentiment, last_topic_discussed,
//   special_notes — overwritten if provided.
//   topics_discussed — appended (deduped) rather than overwritten, so history accumulates.
//   incrementAppointments — bumps appointment_count by 1 when true.
//   respondedOk — used to recompute a simple rolling response_rate (see below).
export async function updateMemory({ contactId, phone, email }, patch = {}) {
  if (!isSupabaseConfigured() || (!contactId && !phone && !email)) return null
  try {
    const existing = await getMemory({ contactId, phone, email })

    const nextTopics = Array.isArray(existing?.topics_discussed) ? [...existing.topics_discussed] : []
    if (patch.newTopic && !nextTopics.includes(patch.newTopic)) nextTopics.push(patch.newTopic)

    const body = {
      contact_id: contactId || existing?.contact_id || null,
      contact_phone: phone || existing?.contact_phone || null,
      contact_email: email || existing?.contact_email || null,
      updated_at: new Date().toISOString(),
    }
    if (patch.preferred_language) body.preferred_language = patch.preferred_language
    if (patch.preferred_channel) body.preferred_channel = patch.preferred_channel
    if (patch.best_time_to_contact) body.best_time_to_contact = patch.best_time_to_contact
    if (patch.sentiment) body.sentiment = patch.sentiment
    if (patch.last_topic_discussed) body.last_topic_discussed = patch.last_topic_discussed
    if (patch.special_notes) body.special_notes = patch.special_notes
    if (nextTopics.length) body.topics_discussed = nextTopics
    if (patch.incrementAppointments) body.appointment_count = (existing?.appointment_count || 0) + 1
    if (typeof patch.respondedOk === 'boolean') {
      // Simple exponential moving average so one bad/good interaction doesn't swing it wildly.
      const prev = existing?.response_rate ?? 50
      body.response_rate = Math.round(prev * 0.8 + (patch.respondedOk ? 100 : 0) * 0.2)
    }

    if (existing) {
      await supabaseFetch(`nova_memory?id=eq.${existing.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body),
      })
    } else {
      await supabaseFetch('nova_memory', {
        method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body),
      })
    }
    return body
  } catch (err) {
    console.error('[memory:updateMemory] Failed:', err.message)
    return null
  }
}
