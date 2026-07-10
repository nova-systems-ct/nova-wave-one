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
export async function testPhone(phone) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!phone) return { tested: false, phone_score: 50, reason: 'No phone number provided' }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('[nova-audit] Twilio credentials missing — skipping phone test, using default phone_score=50')
    return { tested: false, phone_score: 50, reason: 'Twilio not configured' }
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    const call = await client.calls.create({
      to: phone,
      from: TWILIO_PHONE_NUMBER,
      twiml: '<Response><Say>This is a connection test from Nova Systems. Please disregard this call. Thank you.</Say><Hangup/></Response>',
    })

    let status = call.status
    for (let i = 0; i < 4 && !['completed', 'in-progress', 'no-answer', 'busy', 'failed', 'canceled'].includes(status); i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      try {
        const updated = await client.calls(call.sid).fetch()
        status = updated.status
      } catch (err) {
        console.error('[nova-audit:testPhone] Status poll failed (non-fatal):', err.message)
        break
      }
    }

    let phone_score
    if (status === 'completed' || status === 'in-progress') phone_score = 80
    else if (status === 'no-answer' || status === 'busy') phone_score = 20
    else phone_score = 50 // couldn't determine within the polling window — default

    return { tested: true, call_sid: call.sid, status, phone_score }
  } catch (err) {
    console.error('[nova-audit:testPhone] Error (continuing with phone_score=50):', err.message)
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

function fallbackCompetitors(industry, city) {
  return [
    { name: `${industry} Leader in ${city}`, estimated_google_rating: 4.6, review_count: 180, has_website: true, has_online_booking: true, social_score: 75, estimated_monthly_traffic: '800-1200 visitors', advantages: ['Stronger Google presence', 'Online booking enabled', 'Faster website'], what_client_does_better: 'Personalized local service' },
    { name: `Established ${industry} Competitor`, estimated_google_rating: 4.3, review_count: 95, has_website: true, has_online_booking: false, social_score: 55, estimated_monthly_traffic: '400-700 visitors', advantages: ['More reviews', 'Longer operating history'], what_client_does_better: 'More modern branding' },
    { name: `Growing ${industry} Business Nearby`, estimated_google_rating: 4.4, review_count: 60, has_website: false, has_online_booking: false, social_score: 65, estimated_monthly_traffic: '200-400 visitors', advantages: ['Active social media presence'], what_client_does_better: 'Established website and online presence' },
  ]
}

export async function discoverCompetitors({ businessName, industry, city }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    console.warn('[nova-audit] ANTHROPIC_API_KEY missing — skipping competitor discovery, using fallback data')
    return fallbackCompetitors(industry, city)
  }

  try {
    const anthropic = new Anthropic({ apiKey: key })
    // claude-haiku-20240307 (the model originally requested) has been retired — using the
    // current fast/cheap Haiku model instead, same intent (cheapest model, low latency).
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: 'You are a Connecticut business market analyst. Always respond with valid JSON only. No explanation. No markdown. Just the JSON array.',
      messages: [{
        role: 'user',
        content: `Find the top 3 local competitors for a ${industry} business called "${businessName}" in ${city}, Connecticut that are currently outperforming them. Return a JSON array of exactly 3 objects with these fields: name (string), estimated_google_rating (number 1-5), review_count (number), has_website (boolean), has_online_booking (boolean), social_score (number 0-100), estimated_monthly_traffic (string like "500-1000 visitors"), advantages (array of 3 strings describing what they do better), what_client_does_better (string).`,
      }],
    })
    const text = msg.content?.[0]?.text || '[]'
    const match = text.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match ? match[0] : text)
    return Array.isArray(parsed) && parsed.length ? parsed.slice(0, 3) : fallbackCompetitors(industry, city)
  } catch (err) {
    console.error('[nova-audit:discoverCompetitors] Error (continuing with fallback competitors):', err.message)
    return fallbackCompetitors(industry, city)
  }
}
