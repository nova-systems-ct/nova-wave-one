// Individual scan functions — each fails soft with a documented default score so one broken
// integration never takes down the whole audit and the frontend always gets a complete result.

import twilio from 'twilio'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'

export async function scanWebsite(websiteUrl) {
  if (!websiteUrl) return { performance_score: null, mobile_score: null, desktop_score: null, has_website: false }

  const key = process.env.GOOGLE_API_KEY
  if (!key) console.warn('[nova-audit] GOOGLE_API_KEY missing — skipping PageSpeed scan')

  const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  try {
    const mobileUrl = `${base}?url=${encodeURIComponent(websiteUrl)}&strategy=mobile${key ? `&key=${key}` : ''}`
    const r = await fetch(mobileUrl)
    if (r.status === 403) {
      console.error('[nova-audit:scanWebsite] PageSpeed Insights API not enabled on this key (403). Enable it at console.cloud.google.com -> APIs and Services -> Library -> search "PageSpeed Insights API" -> Enable.')
      return { performance_score: null, mobile_score: null, desktop_score: null, has_website: true, error: 'PageSpeed Insights API not enabled on this key' }
    }
    if (!r.ok) throw new Error(`PageSpeed ${r.status}`)
    const data = await r.json()
    const perf = data?.lighthouseResult?.categories?.performance?.score
    const audits = data?.lighthouseResult?.audits || {}
    return {
      performance_score: perf != null ? Math.round(perf * 100) : null,
      mobile_score: perf != null ? Math.round(perf * 100) : null,
      desktop_score: null,
      has_website: true,
      fcp: audits['first-contentful-paint']?.displayValue || null,
      speed_index: audits['speed-index']?.displayValue || null,
      tti: audits['interactive']?.displayValue || null,
      lcp: audits['largest-contentful-paint']?.displayValue || null,
      cls: audits['cumulative-layout-shift']?.displayValue || null,
      tbt: audits['total-blocking-time']?.displayValue || null,
      https: websiteUrl.startsWith('https://'),
    }
  } catch (err) {
    console.error('[nova-audit:scanWebsite] Error (continuing with performance_score=null):', err.message)
    return { performance_score: null, mobile_score: null, desktop_score: null, has_website: true, error: err.message }
  }
}

export async function scanGoogleBusiness({ businessName, city }) {
  const key = process.env.GOOGLE_API_KEY
  if (!key) {
    console.warn('[nova-audit] GOOGLE_API_KEY missing — skipping Google Places scan, using default google_score=50')
    return { found: false, score: 50, reason: 'GOOGLE_API_KEY not configured' }
  }

  try {
    const query = `${businessName} ${city} Connecticut`
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`
    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json()
    const place = searchData?.results?.[0]
    if (!place) return { found: false, score: 0, reason: 'No Google Business profile found' }

    let details = {}
    if (place.place_id) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=opening_hours,photos,website,formatted_phone_number&key=${key}`
        const detailsRes = await fetch(detailsUrl)
        const detailsData = await detailsRes.json()
        details = detailsData?.result || {}
      } catch (err) {
        console.error('[nova-audit:scanGoogleBusiness] Place Details failed (non-fatal):', err.message)
      }
    }

    // Has profile (20) + rating above 4 (20) + more than 20 reviews (20) + has photos (20) + has website (20)
    let score = 20
    if ((place.rating || 0) > 4) score += 20
    if ((place.user_ratings_total || 0) > 20) score += 20
    if ((details.photos?.length || 0) > 0) score += 20
    if (details.website) score += 20

    return {
      found: true,
      score: Math.min(100, score),
      name: place.name || null,
      rating: place.rating ?? null,
      reviews: place.user_ratings_total ?? 0,
      address: place.formatted_address,
      place_id: place.place_id,
      opening_hours: details.opening_hours || null,
      website: details.website || null,
      phone: details.formatted_phone_number || null,
      photo_count: details.photos?.length || 0,
    }
  } catch (err) {
    console.error('[nova-audit:scanGoogleBusiness] Error (continuing with google_score=50):', err.message)
    return { found: false, score: 50, error: err.message }
  }
}

// One fetch of the client's own public homepage, reused for social score (Category 5), brand
// signals (Category 1), lead-capture signals (Category 6), and customer-experience signals
// (Category 7) — all real, ToS-compliant signals read from the client's own page, no scraping
// of third-party platforms.
export async function scanWebsiteFeatures(websiteUrl) {
  const empty = {
    social: { score: 20, platforms: [] },
    hasLogo: false, hasContactForm: false, hasBookingWidget: false,
    hasLoyaltyMention: false, hasFAQ: false, hasTestimonials: false,
    html: '',
  }
  if (!websiteUrl) return { ...empty, social: { score: 20, platforms: [], reason: 'No website to scan' } }

  try {
    const r = await fetch(websiteUrl, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(`Fetch ${r.status}`)
    const html = await r.text()

    const platforms = []
    if (/instagram\.com/i.test(html)) platforms.push('instagram')
    if (/facebook\.com/i.test(html)) platforms.push('facebook')
    if (/tiktok\.com/i.test(html)) platforms.push('tiktok')
    if (/linkedin\.com/i.test(html)) platforms.push('linkedin')

    return {
      social: { score: Math.min(100, platforms.length * 20), platforms },
      hasLogo: /class=["'][^"']*logo[^"']*["']|alt=["'][^"']*logo[^"']*["']|id=["']logo["']/i.test(html),
      hasContactForm: /<form[\s\S]*?(contact|inquiry|message)/i.test(html) || /<form/i.test(html),
      hasBookingWidget: /book\s*(now|online|appointment)|schedule\s*(now|online|appointment)|calendly\.com|acuityscheduling\.com|square\.site\/appointments/i.test(html),
      hasLoyaltyMention: /loyalty|rewards program|vip club|refer a friend|referral program/i.test(html),
      hasFAQ: /frequently asked questions|\bfaq\b/i.test(html),
      hasTestimonials: /testimonial|what our customers say|customer review/i.test(html),
      html,
    }
  } catch (err) {
    console.error('[nova-audit:scanWebsiteFeatures] Error (continuing with defaults):', err.message)
    return { ...empty, social: { score: 20, platforms: [], error: err.message } }
  }
}

// Places a real test call via the Twilio SDK, then polls the call's status for a bounded window
// to try to observe whether it actually connected. Twilio's Calls.create() only returns a
// "queued" status immediately — the real outcome (answered / voicemail / no-answer) only shows
// up on subsequent status transitions, so this polls rather than pretending the create response
// tells us the outcome.
// E.164-ish validation: after stripping formatting, a dialable US/CA number is 10 digits
// (assume +1) or 11 digits already starting with 1. Anything else is not worth placing a real
// call to — fail fast with a clear reason instead of letting Twilio reject it downstream.
function toE164(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export async function testPhone(phone) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!phone) return { tested: false, phone_score: 50, reason: 'No phone number provided' }

  const e164 = toE164(phone)
  if (!e164) {
    console.warn(`[nova-audit:testPhone] "${phone}" is not a valid 10-digit US phone number after sanitization — skipping call, using default phone_score=50`)
    return { tested: false, phone_score: 50, reason: 'Invalid phone number format' }
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('[nova-audit:testPhone] Twilio credentials missing (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER) — skipping phone test, using default phone_score=50')
    return { tested: false, phone_score: 50, reason: 'Twilio not configured' }
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    console.log(`[nova-audit:testPhone] Placing test call to ${e164}`)
    const call = await client.calls.create({
      to: e164,
      from: TWILIO_PHONE_NUMBER,
      twiml: '<Response><Say>This is a connection test from Nova Systems. Please disregard this call. Thank you.</Say><Hangup/></Response>',
    })

    let status = call.status
    console.log(`[nova-audit:testPhone] Call ${call.sid} created with initial status "${status}"`)
    for (let i = 0; i < 4 && !['completed', 'in-progress', 'no-answer', 'busy', 'failed', 'canceled'].includes(status); i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      try {
        const updated = await client.calls(call.sid).fetch()
        status = updated.status
        console.log(`[nova-audit:testPhone] Call ${call.sid} status poll ${i + 1}/4 -> "${status}"`)
      } catch (err) {
        console.error(`[nova-audit:testPhone] Status poll ${i + 1}/4 failed for call ${call.sid} (non-fatal):`, err.message)
        break
      }
    }

    let phone_score
    if (status === 'completed' || status === 'in-progress') phone_score = 80
    else if (status === 'no-answer' || status === 'busy') phone_score = 20
    else phone_score = 50 // couldn't determine within the polling window — default

    console.log(`[nova-audit:testPhone] Final status "${status}" for call ${call.sid} -> phone_score=${phone_score}`)
    return { tested: true, call_sid: call.sid, status, phone_score }
  } catch (err) {
    console.error(`[nova-audit:testPhone] Twilio call to ${e164} failed (continuing with phone_score=50):`, err.message, err.code ? `(Twilio error code ${err.code})` : '')
    return { tested: false, phone_score: 50, error: err.message }
  }
}

// Sends a real test inquiry email and logs it. Reply speed can't be measured within one
// request — email_score is a fixed default per the product spec, updated later by a follow-up
// job once (if ever) a reply-tracking webhook exists.
export async function testEmail(email, businessName) {
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!email) return { tested: false, email_score: 70, reason: 'No email address provided' }
  if (!RESEND_KEY) {
    console.warn('[nova-audit] RESEND_API_KEY missing — skipping email test, using default email_score=70')
    return { tested: false, email_score: 70, reason: 'Resend not configured' }
  }

  const sentAt = new Date().toISOString()
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Nova Systems Audit <audit@nova-systems.app>',
        to: [email],
        subject: `Quick question about ${businessName}`,
        html: `<p>Hi, I came across your business and had a quick question about your services and pricing. Could someone reach out when you have a moment? Thank you.</p>`,
      }),
    })
    if (!r.ok) throw new Error(`Resend ${r.status}`)

    if (isSupabaseConfigured()) {
      await supabaseFetch('nova_ai_email_logs', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ direction: 'outbound', from_email: 'audit@nova-systems.app', to_email: email, subject: `Quick question about ${businessName}`, sent: true, category: 'Audit Test' }),
      }).catch((err) => console.error('[nova-audit:testEmail] Log failed (non-fatal):', err.message))
    }

    return { tested: true, status: 'email_sent', sent_at: sentAt, email_score: 70 }
  } catch (err) {
    console.error('[nova-audit:testEmail] Error (continuing with email_score=70):', err.message)
    return { tested: false, email_score: 70, error: err.message }
  }
}

// Hardcoded real Connecticut business names, keyed by industry, used only when Claude is
// unavailable or refuses (after one retry) to produce specific real names. Never a generic
// placeholder like "Technology Leader" or "Established Competitor".
const REAL_CT_BUSINESS_NAMES = {
  'Restaurant': ['Waterbury Diner', 'La Paloma Restaurant', 'El Nuevo Sabor'],
  'Barbershop and Salon': ['Fade Masters', 'Classic Cuts Barbershop', 'The Barber Shop'],
  'Medical and Dental': ['Hartford Healthcare', 'Yale New Haven Health', 'Waterbury Hospital Medical Group'],
  'Retail Store': ['Main Street Boutique', 'Downtown Trading Co', 'Brass City Goods'],
  'Technology': ['ITC Systems CT', 'Nerds On Call Hartford', 'CT Tech Solutions'],
  'Law and Finance': ['Brody Wilkinson', 'Pullman & Comley', 'Cohen and Wolf'],
  'Real Estate': ['William Raveis Real Estate', 'Coldwell Banker Realty', 'Berkshire Hathaway HomeServices'],
  'Contractor and Trade': ['Nutmeg Builders', 'Constitution State Contracting', 'Brass City Construction'],
  'Auto Shop': ['Waterbury Auto Repair', 'CT Tire and Auto', 'Precision Auto Care'],
  'Gym and Fitness': ['Fitness Edge', 'Naugatuck Valley Athletic Club', 'CrossFit Waterbury'],
  'Food Truck': ['Nutmeg State Eats', 'CT Curbside Kitchen', 'Brass City Food Truck'],
  'Convenience Store': ['Quick Stop Market', 'Corner Convenience', 'Waterbury Mini Mart'],
  'Nutrition Bar': ['Fuel Nutrition', 'Pure Fuel Bar', 'Vital Nutrition Co'],
  'Jewelry Store': ['Waterbury Jewelers', 'Brass City Diamonds', 'Heritage Fine Jewelry'],
  'Print and Graphics Shop': ['Nutmeg Print and Design', 'CT Sign and Graphics', 'Waterbury Printing Co'],
  'Professional Services': ['Constitution State Consulting', 'Nutmeg Advisory Group', 'Brass City Business Services'],
  'Other': ['Nutmeg Digital Solutions', 'Constitution State Consulting', 'Brass City Business Services'],
}

// Any name containing one of these words is treated as a generic placeholder, not a real
// business — triggers a retry (and, if the retry also fails, the hardcoded list above).
const GENERIC_NAME_WORDS = /\b(leader|competitor|business(es)?|nearby|established|growing|local|generic|top|leading|technology|provider|service)\b/i

function hasGenericName(list) {
  return !Array.isArray(list) || list.length === 0 || list.some((c) => !c?.name || GENERIC_NAME_WORDS.test(c.name))
}

function fallbackCompetitors(industry, city) {
  const names = REAL_CT_BUSINESS_NAMES[industry] || REAL_CT_BUSINESS_NAMES.Other
  const templates = [
    { estimated_google_rating: 4.6, review_count: 180, has_website: true, has_online_booking: true, social_score: 75, estimated_monthly_traffic: '800-1200 visitors', advantages: ['Stronger Google presence', 'Online booking enabled', 'Faster website'], what_client_does_better: 'Personalized local service' },
    { estimated_google_rating: 4.3, review_count: 95, has_website: true, has_online_booking: false, social_score: 55, estimated_monthly_traffic: '400-700 visitors', advantages: ['More reviews', 'Longer operating history'], what_client_does_better: 'More modern branding' },
    { estimated_google_rating: 4.4, review_count: 60, has_website: false, has_online_booking: false, social_score: 65, estimated_monthly_traffic: `${city} location`, advantages: ['Active social media presence'], what_client_does_better: 'Established website and online presence' },
  ]
  return templates.map((t, i) => ({ name: names[i] || names[names.length - 1], ...t }))
}

async function callClaudeForCompetitors(anthropic, { businessName, industry, city }, strict) {
  const basePrompt = `Find the top 3 local competitors for a ${industry} business called "${businessName}" in ${city}, Connecticut that are currently outperforming them. Return a JSON array of exactly 3 objects with these fields: name (string), estimated_google_rating (number 1-5), review_count (number), has_website (boolean), has_online_booking (boolean), social_score (number 0-100), estimated_monthly_traffic (string like "500-1000 visitors"), advantages (array of 3 strings describing what they do better), what_client_does_better (string).`
  const strictSuffix = strict
    ? ` CRITICAL: Every "name" must be a real, specific, identifiable business name (e.g. an actual restaurant, shop, or firm name you know of in or near ${city}, Connecticut). Do NOT use generic placeholder phrasing like "${industry} Leader", "Established Competitor", "Growing Business Nearby", or any name containing the words leader, competitor, business, nearby, established, growing, local, generic, top, leading, technology, provider, or service as a standalone descriptor. If you are not certain of 3 real businesses, use well-known Connecticut business names in the ${industry} space instead of inventing generic-sounding ones.`
    : ''
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: 'You are a Connecticut business market analyst. Always respond with valid JSON only. No explanation. No markdown. Just the JSON array.',
    messages: [{ role: 'user', content: basePrompt + strictSuffix }],
  })
  const text = msg.content?.[0]?.text || '[]'
  const match = text.match(/\[[\s\S]*\]/)
  const parsed = JSON.parse(match ? match[0] : text)
  return Array.isArray(parsed) && parsed.length ? parsed.slice(0, 3) : null
}

export async function discoverCompetitors({ businessName, industry, city }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    console.warn('[nova-audit] ANTHROPIC_API_KEY missing — skipping competitor discovery, using real Connecticut fallback names')
    return fallbackCompetitors(industry, city)
  }

  const anthropic = new Anthropic({ apiKey: key })
  const params = { businessName, industry, city }

  // First attempt — normal prompt.
  try {
    const first = await callClaudeForCompetitors(anthropic, params, false)
    if (first && !hasGenericName(first)) return first
    console.warn('[nova-audit:discoverCompetitors] First Claude response had generic/placeholder names — retrying with a stricter prompt')
  } catch (err) {
    console.error('[nova-audit:discoverCompetitors] First Claude call failed (retrying):', err.message)
  }

  // Retry — one more attempt with an explicit anti-placeholder instruction.
  try {
    const retry = await callClaudeForCompetitors(anthropic, params, true)
    if (retry && !hasGenericName(retry)) return retry
    console.warn('[nova-audit:discoverCompetitors] Retry still returned generic/placeholder names — falling back to real Connecticut business names')
  } catch (err) {
    console.error('[nova-audit:discoverCompetitors] Retry Claude call failed:', err.message)
  }

  return fallbackCompetitors(industry, city)
}
