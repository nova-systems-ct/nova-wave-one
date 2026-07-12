// Nova Book — native booking system (no Cal.com dependency). Meeting types, availability,
// confirmations via Nova Blue/Nova Email, and cross-engine hooks into CRM/Revive.
import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail, sanitizePhone } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { onNewContact, onMeetingBooked } from '../_integrations.js'
import { alertIsaac } from '../_automation.js'

export const MEETING_TYPES = [
  { id: 'strategy_call', label: 'Free Strategy Call', minutes: 30 },
  { id: 'wave_one_demo', label: 'Wave One Demo', minutes: 45 },
  { id: 'client_onboarding', label: 'Client Onboarding', minutes: 60 },
  { id: 'quick_checkin', label: 'Quick Check-in', minutes: 15 },
]

// Simple fixed weekly availability — Mon-Fri, 9am-5pm ET, in 30-minute slots. No external
// calendar sync; meetings already booked for a given date/time are excluded.
function generateSlots(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`)
  const day = date.getDay()
  if (day === 0 || day === 6) return []
  const slots = []
  for (let hour = 9; hour < 17; hour++) {
    for (const min of [0, 30]) {
      slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
    }
  }
  return slots
}

async function sendConfirmation({ contact_name, contact_phone, contact_email, meeting_type, meeting_date, meeting_time }) {
  const typeLabel = MEETING_TYPES.find((t) => t.id === meeting_type)?.label || meeting_type
  const text = `Hi ${contact_name}, your ${typeLabel} with Nova Systems is confirmed for ${meeting_date} at ${meeting_time}. Reply STOP to opt out.`

  if (contact_phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: contact_phone, From: process.env.TWILIO_PHONE_NUMBER, Body: text }).toString(),
      })
    } catch (err) { console.error('[nova-book] SMS confirmation failed (non-fatal):', err.message) }
  }
  if (contact_email && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Nova Systems <hello@nova-systems.app>', to: [contact_email],
          subject: `Confirmed: ${typeLabel} with Nova Systems`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
            <div style="background:#080808;padding:24px;text-align:center;"><span style="color:#C8A96E;font-weight:900;letter-spacing:2px;">NOVA SYSTEMS</span></div>
            <div style="padding:28px;border:1px solid #eee;border-top:none;">
              <h2>You're confirmed, ${contact_name}!</h2>
              <p><strong>${typeLabel}</strong><br/>${meeting_date} at ${meeting_time} (ET)</p>
              <p>We'll send a reminder before your meeting. Reply to this email if you need to reschedule.</p>
            </div></div>`,
        }),
      })
    } catch (err) { console.error('[nova-book] Email confirmation failed (non-fatal):', err.message) }
  }
}

// ============================================================ ACTION: get_availability =======

async function handleGetAvailability(req, res) {
  const date = sanitize(req.query?.date, 20)
  if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' })

  const allSlots = generateSlots(date)
  let booked = []
  if (isSupabaseConfigured()) {
    const r = await supabaseFetch(`nova_book_meetings?meeting_date=eq.${encodeURIComponent(date)}&status=neq.cancelled&select=meeting_time`)
    booked = r.ok ? (await r.json()).map((m) => m.meeting_time) : []
  }
  return res.status(200).json({ date, meeting_types: MEETING_TYPES, available_slots: allSlots.filter((s) => !booked.includes(s)) })
}

// ============================================================ ACTION: create_meeting =========

async function handleCreateMeeting(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const contact_name = sanitize(b.contact_name, 100)
  const contact_email = b.contact_email ? sanitizeEmail(b.contact_email) : null
  const contact_phone = b.contact_phone ? sanitizePhone(b.contact_phone) : null
  const meeting_type = MEETING_TYPES.some((t) => t.id === b.meeting_type) ? b.meeting_type : 'strategy_call'
  const meeting_date = sanitize(b.meeting_date, 20)
  const meeting_time = sanitize(b.meeting_time, 10)

  if (!contact_name || !meeting_date || !meeting_time || (!contact_email && !contact_phone)) {
    return res.status(400).json({ error: 'contact_name, meeting_date, meeting_time, and at least one of contact_email/contact_phone are required' })
  }
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  // Double-booking guard.
  const clash = await supabaseFetch(`nova_book_meetings?meeting_date=eq.${encodeURIComponent(meeting_date)}&meeting_time=eq.${encodeURIComponent(meeting_time)}&status=neq.cancelled&select=id`)
  if (clash.ok && (await clash.json()).length) return res.status(409).json({ error: 'That time slot was just booked. Please pick another.' })

  const contact = await onNewContact({
    business_name: sanitize(b.business_name, 200) || contact_name, owner_name: contact_name,
    phone: contact_phone, email: contact_email, source: 'nova_book', status: 'warm_lead',
  })

  const r = await supabaseFetch('nova_book_meetings', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      contact_id: contact?.id || null, contact_name, contact_email, contact_phone,
      meeting_type, meeting_date, meeting_time, status: 'confirmed', notes: sanitize(b.notes, 1000) || null,
    }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to book meeting' })
  const meeting = (await r.json())[0]

  await sendConfirmation({ contact_name, contact_phone, contact_email, meeting_type, meeting_date, meeting_time })
  await onMeetingBooked(contact?.id, { meeting_type })
  await alertIsaac(`Nova Book: ${contact_name} booked a ${MEETING_TYPES.find((t) => t.id === meeting_type)?.label} for ${meeting_date} at ${meeting_time}.`).catch(() => {})

  return res.status(200).json({ ok: true, meeting })
}

// ============================================================ ACTION: get_meetings ===========

async function handleGetMeetings(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const q = req.query || {}
  const filters = []
  if (q.status) filters.push(`status=eq.${encodeURIComponent(q.status)}`)
  if (q.upcoming === 'true') filters.push(`meeting_date=gte.${new Date().toISOString().slice(0, 10)}`)
  const query = filters.length ? `&${filters.join('&')}` : ''
  const r = await supabaseFetch(`nova_book_meetings?order=meeting_date.asc,meeting_time.asc&limit=200${query}`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: cancel_meeting =========

async function handleCancelMeeting(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  const r = await supabaseFetch(`nova_book_meetings?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'cancelled' }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Cancel failed' })
  return res.status(200).json({ ok: true })
}

// ============================================================ ACTION: reschedule_meeting =====

async function handleRescheduleMeeting(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  const meeting_date = sanitize(b.meeting_date, 20)
  const meeting_time = sanitize(b.meeting_time, 10)
  if (!id || !meeting_date || !meeting_time) return res.status(400).json({ error: 'id, meeting_date, and meeting_time are required' })

  const r = await supabaseFetch(`nova_book_meetings?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ meeting_date, meeting_time, status: 'confirmed' }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Reschedule failed' })
  const rows = await r.json()
  const meeting = rows[0]
  if (meeting) await sendConfirmation(meeting)
  return res.status(200).json({ ok: true, meeting })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Book', ['SUPABASE_SERVICE_ROLE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'RESEND_API_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'create_meeting':      return await handleCreateMeeting(req, res)
      case 'get_meetings':        return await handleGetMeetings(req, res)
      case 'cancel_meeting':      return await handleCancelMeeting(req, res)
      case 'reschedule_meeting':  return await handleRescheduleMeeting(req, res)
      case 'get_availability':    return await handleGetAvailability(req, res)
      default:
        if (req.method === 'GET' && !action) return await handleGetMeetings(req, res)
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Book] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
