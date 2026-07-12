// Nova Reviews — reputation management via Google Places API.
import { setCors } from '../_cors.js'
import { sanitize, sanitizePhone } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { callClaude } from '../_agents.js'
import { alertIsaac } from '../_automation.js'

// ============================================================ ACTION: fetch_reviews ==========

async function handleFetchReviews(req, res) {
  const key = process.env.GOOGLE_API_KEY
  if (!key) return res.status(500).json({ error: 'GOOGLE_API_KEY is not configured' })
  const place_id = sanitize(req.query?.place_id || req.body?.place_id, 200)
  if (!place_id) {
    // Cron entry point (no place_id) — there's no place_id column on nova_crm_contacts yet to
    // loop over, so this is a documented no-op rather than an error until that's added.
    return res.status(200).json({ ok: true, note: 'No place_id provided and no default businesses configured yet — pass place_id to check a specific business.' })
  }

  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=rating,reviews,user_ratings_total&key=${key}`)
    const data = await r.json()
    const reviews = data?.result?.reviews || []
    let saved = 0

    if (isSupabaseConfigured()) {
      for (const rev of reviews) {
        const exists = await supabaseFetch(`nova_reviews?place_id=eq.${encodeURIComponent(place_id)}&reviewer_name=eq.${encodeURIComponent(rev.author_name)}&rating=eq.${rev.rating}&limit=1`)
        const rows = exists.ok ? await exists.json() : []
        if (rows.length) continue
        await supabaseFetch('nova_reviews', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ place_id, platform: 'google', reviewer_name: rev.author_name, rating: rev.rating, review_text: rev.text || '' }),
        })
        saved++
      }
    }
    return res.status(200).json({ ok: true, rating: data?.result?.rating, total: data?.result?.user_ratings_total, new_reviews_saved: saved })
  } catch (err) {
    console.error('[nova-reviews:fetch_reviews] Failed:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ============================================================ ACTION: get_reviews =============

async function handleGetReviews(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_reviews?order=created_at.desc&limit=200')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: generate_response =======

async function handleGenerateResponse(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id || !isSupabaseConfigured()) return res.status(400).json({ error: 'id is required' })

  const r = await supabaseFetch(`nova_reviews?id=eq.${encodeURIComponent(id)}&limit=1`)
  const review = r.ok ? (await r.json())[0] : null
  if (!review) return res.status(404).json({ error: 'Review not found' })

  const isPositive = review.rating >= 4
  const systemPrompt = isPositive
    ? 'Write a warm, personalized thank-you response to a positive business review. Reference something specific from the review. Under 60 words.'
    : 'Write a professional, empathetic response to a negative business review. Acknowledge the concern, apologize where appropriate, offer to resolve it, and invite them to continue the conversation offline. Under 80 words. Never be defensive.'
  const ai_response = await callClaude(systemPrompt, `Reviewer: ${review.reviewer_name}, Rating: ${review.rating}/5\n\n${review.review_text}`, { maxTokens: 200, temperature: 0.5 })

  await supabaseFetch(`nova_reviews?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ai_response }) }).catch(() => {})
  if (!isPositive) await alertIsaac(`Nova Reviews: a ${review.rating}-star review from ${review.reviewer_name} needs your review before responding.`).catch(() => {})

  return res.status(200).json({ ok: true, ai_response, auto_send_recommended: isPositive })
}

// ============================================================ ACTION: send_response ============
// Google doesn't allow posting review replies via the public Places API — that requires Google
// Business Profile API with OAuth per-business, which is a separate integration. This marks the
// response as sent in our records so the dashboard workflow is complete; the actual posting must
// happen in the Google Business Profile dashboard until that OAuth flow is built.

async function handleSendResponse(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  const r = await supabaseFetch(`nova_reviews?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ response_sent: true }) })
  if (!r.ok) return res.status(500).json({ error: 'Update failed' })
  return res.status(200).json({ ok: true, note: 'Marked sent. Google Places API does not support posting replies directly — paste this response in Google Business Profile.' })
}

// ============================================================ ACTION: request_review ===========

async function handleRequestReview(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const phone = b.phone ? sanitizePhone(b.phone) : null
  const name = sanitize(b.name, 100) || 'there'
  const business_name = sanitize(b.business_name, 200) || 'us'
  const review_link = sanitize(b.review_link, 500) || 'https://g.page/r/review'
  if (!phone) return res.status(400).json({ error: 'phone is required' })
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) return res.status(500).json({ error: 'Twilio not configured' })

  const body = `Hey ${name}, thank you for visiting ${business_name}. If you have 30 seconds a Google review would mean a lot: ${review_link}`
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_NUMBER, Body: body }).toString(),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return res.status(500).json({ error: data?.message || 'Send failed' })
  return res.status(200).json({ ok: true, message_sid: data.sid })
}

// ============================================================ ACTION: get_analytics ============

async function handleGetAnalytics(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ average: null, trend: [] })
  const r = await supabaseFetch('nova_reviews?select=rating,created_at&order=created_at.asc&limit=1000')
  const reviews = r.ok ? await r.json() : []
  const average = reviews.length ? reviews.reduce((s, rv) => s + rv.rating, 0) / reviews.length : null

  const byWeek = {}
  for (const rv of reviews) {
    const week = new Date(rv.created_at); week.setDate(week.getDate() - week.getDay())
    const key = week.toISOString().slice(0, 10)
    if (!byWeek[key]) byWeek[key] = []
    byWeek[key].push(rv.rating)
  }
  const trend = Object.entries(byWeek).map(([week, ratings]) => ({ week, average: ratings.reduce((s, r) => s + r, 0) / ratings.length }))
  return res.status(200).json({ average, total: reviews.length, trend })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Reviews', ['GOOGLE_API_KEY', 'ANTHROPIC_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'fetch_reviews':      return await handleFetchReviews(req, res)
      case 'get_reviews':        return await handleGetReviews(req, res)
      case 'generate_response':  return await handleGenerateResponse(req, res)
      case 'send_response':      return await handleSendResponse(req, res)
      case 'request_review':     return await handleRequestReview(req, res)
      case 'get_analytics':      return await handleGetAnalytics(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Reviews] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
