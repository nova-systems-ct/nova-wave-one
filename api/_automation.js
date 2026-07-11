// Shared safety, rate-limiting, and alerting helpers used by every Wave One engine (SMS, Email,
// Voice, WhatsApp, Social, Revive) so these rules are enforced identically everywhere instead of
// being re-implemented (and drifting) per engine.
import { supabaseFetch, isSupabaseConfigured } from './_supabaseAdmin.js'

// --- Isaac alerting -----------------------------------------------------------------------

// Where Isaac receives operational alerts (missed calls, low-confidence drafts, errors, hot-lead
// replies). Set ISAAC_ALERT_PHONE to Isaac's personal cell in production — it falls back to the
// Nova Systems Twilio number only so alerts never silently vanish if that var isn't set yet, not
// because texting the business line to itself is the intended long-term setup.
export function alertPhone() {
  return process.env.ISAAC_ALERT_PHONE || process.env.TWILIO_PHONE_NUMBER || ''
}

export async function sendRawSms(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !to) {
    return { ok: false, error: 'Twilio not configured or recipient missing' }
  }
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body }).toString(),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data?.message || `Twilio ${r.status}`)
    return { ok: true, message_sid: data.sid }
  } catch (err) {
    console.error('[automation:sendRawSms] Failed:', err.message)
    return { ok: false, error: err.message }
  }
}

export async function alertIsaac(message) {
  const to = alertPhone()
  if (!to) {
    console.warn('[automation:alertIsaac] No ISAAC_ALERT_PHONE/TWILIO_PHONE_NUMBER configured — alert not sent:', message)
    return { ok: false }
  }
  return sendRawSms(to, message)
}

export async function reportEngineError(engine, action, contact, err) {
  console.error(`[automation:error] ${engine} failed to ${action} for ${contact || 'unknown contact'}:`, err?.message || err)
  await alertIsaac(`Nova AI Error: ${engine} failed to ${action} for ${contact || 'a contact'}. Check dashboard.`).catch(() => {})
}

export async function alertHotLeadReply(channel, contactLabel) {
  await alertIsaac(`Hot lead responding on ${channel}: ${contactLabel}. Check your dashboard.`).catch(() => {})
}

// --- Opt-out / STOP handling ---------------------------------------------------------------

const STOP_WORDS = /^\s*(stop|unsubscribe|cancel|end|quit|remove me|do ?not ?contact)\s*[.!]?\s*$/i

export function isStopMessage(text) {
  return STOP_WORDS.test(String(text || '').trim())
}

export async function isOptedOut(contact) {
  if (!contact || !isSupabaseConfigured()) return false
  try {
    const r = await supabaseFetch(
      `nova_ai_audits?or=(phone.eq.${encodeURIComponent(contact)},email.eq.${encodeURIComponent(contact)})&opted_out=eq.true&select=id&limit=1`
    )
    const rows = r.ok ? await r.json() : []
    return rows.length > 0
  } catch (err) {
    console.error('[automation:isOptedOut] Check failed (defaulting to not opted out):', err.message)
    return false
  }
}

// Marks every lead record matching this phone or email as opted out forever and logs it. Called
// the moment any channel receives a STOP/UNSUBSCRIBE reply — from that point on no engine may
// ever contact this phone or email again (every send path in every engine checks isOptedOut()
// first).
export async function optOutContact(contact, reason = 'Replied STOP') {
  if (!isSupabaseConfigured() || !contact) return
  try {
    await supabaseFetch(
      `nova_ai_audits?or=(phone.eq.${encodeURIComponent(contact)},email.eq.${encodeURIComponent(contact)})`,
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ opted_out: true, outreach_status: 'opted_out' }) }
    )
    await supabaseFetch('nova_ai_revive_logs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ channel: 'system', message: reason, outcome: 'opted_out' }),
    })
  } catch (err) {
    console.error('[automation:optOutContact] Failed:', err.message)
  }
}

// --- Rate limiting: never more than `max` outbound messages/day/contact, across channels ---

export async function underDailyRateLimit({ phone, email } = {}, max = 3) {
  if ((!phone && !email) || !isSupabaseConfigured()) return true
  const since = new Date(); since.setHours(0, 0, 0, 0)
  try {
    let count = 0
    if (phone) {
      const r = await supabaseFetch(`nova_ai_sms_logs?contact_phone=eq.${encodeURIComponent(phone)}&direction=eq.outbound&created_at=gte.${since.toISOString()}&select=id`)
      count += r.ok ? (await r.json()).length : 0
    }
    if (email) {
      const r = await supabaseFetch(`nova_ai_email_logs?to_email=eq.${encodeURIComponent(email)}&direction=eq.outbound&created_at=gte.${since.toISOString()}&select=id`)
      count += r.ok ? (await r.json()).length : 0
    }
    return count < max
  } catch (err) {
    console.error('[automation:underDailyRateLimit] Check failed (defaulting to allow):', err.message)
    return true
  }
}

// --- Content filter -------------------------------------------------------------------------
// Heuristic, regex-based checks for the categories the spec calls out. This is a real filter
// (not a stub) — it blocks and reports every match — but content moderation by regex is
// necessarily incomplete; it is a safety net alongside the confidence gate below, not a
// substitute for human review of anything genuinely sensitive.

const PROFANITY = /\b(fuck\w*|shit\w*|bitch\w*|asshole\w*|cunt\w*|nigger\w*|faggot\w*)\b/i
const LEGAL_MEDICAL_ADVICE = /\b(legal advice|you should sue|file a lawsuit|i diagnose|diagnosis is|prescri(be|ption)|you (have|might have) (cancer|diabetes|a tumor)|medical advice|this constitutes advice)\b/i
const NEGATIVE_COMPETITOR = /\b(competitors?|rivals?)\b[^.!?]{0,25}\b(suck\w*|terrible|awful|scam\w*|fraud\w*|garbage|bad(ly)? at|worst)\b/i
const LIABILITY_LANGUAGE = /\b(i guarantee|we guarantee|100% guaranteed|no risk at all|risk[- ]free promise|legally binding)\b/i

export function contentFilterCheck(text) {
  const reasons = []
  const t = String(text || '')
  if (PROFANITY.test(t)) reasons.push('profanity')
  if (LEGAL_MEDICAL_ADVICE.test(t)) reasons.push('legal or medical advice')
  if (NEGATIVE_COMPETITOR.test(t)) reasons.push('negative competitor language')
  if (LIABILITY_LANGUAGE.test(t)) reasons.push('liability-creating language')
  return { blocked: reasons.length > 0, reasons }
}

// Runs the content filter and, if blocked, alerts Isaac and returns false (caller must not
// send). Centralizes the "block + alert" behavior so every engine does it the same way.
export async function passesContentFilter(text, { engine, contactLabel }) {
  const { blocked, reasons } = contentFilterCheck(text)
  if (blocked) {
    console.warn(`[automation:contentFilter] Blocked ${engine} message to ${contactLabel}: ${reasons.join(', ')}`)
    await alertIsaac(`Nova AI: blocked a ${engine} message to ${contactLabel} (${reasons.join(', ')}). Check dashboard.`).catch(() => {})
  }
  return !blocked
}

// --- Confidence gate -------------------------------------------------------------------------

export function isLowConfidence(score, threshold = 70) {
  return score == null || Number.isNaN(Number(score)) || Number(score) < threshold
}

// --- Misc shared helpers ---------------------------------------------------------------------

export function daysSince(dateStr) {
  if (!dateStr) return Infinity
  const ms = Date.now() - new Date(dateStr).getTime()
  return ms / (1000 * 60 * 60 * 24)
}

export function hoursSince(dateStr) {
  if (!dateStr) return Infinity
  const ms = Date.now() - new Date(dateStr).getTime()
  return ms / (1000 * 60 * 60)
}

export async function logRevive({ lead_id, channel, message, outcome }) {
  if (!isSupabaseConfigured()) return
  try {
    await supabaseFetch('nova_ai_revive_logs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ lead_id: lead_id || null, channel, message, outcome }),
    })
  } catch (err) {
    console.error('[automation:logRevive] Failed:', err.message)
  }
}

// Personalizes a message template by replacing every [token] with the matching field from data.
// Unmatched tokens are left as-is rather than silently becoming "undefined" in an outbound message.
export function personalize(template, data = {}) {
  return String(template || '').replace(/\[([a-z_]+)\]/gi, (match, key) => {
    const value = data[key]
    return value === undefined || value === null || value === '' ? match : String(value)
  })
}
