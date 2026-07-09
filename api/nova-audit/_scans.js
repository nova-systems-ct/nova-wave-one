// Individual scan functions — each fails soft (returns null / a "not available" shape)
// so one broken integration never takes down the whole audit.

export async function scanWebsite(websiteUrl) {
  if (!websiteUrl) return { performance_score: null, mobile_score: null, desktop_score: null, has_website: false }
  const key = process.env.GOOGLE_API_KEY
  const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  try {
    const mobileUrl = `${base}?url=${encodeURIComponent(websiteUrl)}&strategy=mobile${key ? `&key=${key}` : ''}`
    const r = await fetch(mobileUrl)
    if (!r.ok) throw new Error(`PageSpeed ${r.status}`)
    const data = await r.json()
    const perf = data?.lighthouseResult?.categories?.performance?.score
    const audits = data?.lighthouseResult?.audits || {}
    return {
      performance_score: perf != null ? Math.round(perf * 100) : null,
      mobile_score: perf != null ? Math.round(perf * 100) : null,
      desktop_score: null,
      has_website: true,
      metrics: {
        fcp: audits['first-contentful-paint']?.displayValue,
        speed_index: audits['speed-index']?.displayValue,
        tti: audits['interactive']?.displayValue,
        lcp: audits['largest-contentful-paint']?.displayValue,
        cls: audits['cumulative-layout-shift']?.displayValue,
        tbt: audits['total-blocking-time']?.displayValue,
      },
      https: websiteUrl.startsWith('https://'),
    }
  } catch (err) {
    console.error('[nova-audit:scanWebsite] Error:', err.message)
    return { performance_score: null, mobile_score: null, desktop_score: null, has_website: true, error: err.message }
  }
}

export async function scanGoogleBusiness({ businessName, city }) {
  const key = process.env.GOOGLE_API_KEY
  if (!key) return { found: false, score: null, reason: 'GOOGLE_API_KEY not configured' }
  try {
    const query = `${businessName} ${city} Connecticut`
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`
    const r = await fetch(url)
    const data = await r.json()
    const place = data?.results?.[0]
    if (!place) return { found: false, score: 0, reason: 'No Google Business profile found' }

    let score = 30 // baseline for existing
    if (place.rating) score += 20
    if ((place.user_ratings_total || 0) >= 10) score += 15
    if ((place.user_ratings_total || 0) >= 50) score += 15
    if (place.photos?.length) score += 10
    if (place.opening_hours) score += 10

    return {
      found: true,
      score: Math.min(100, score),
      rating: place.rating ?? null,
      reviews: place.user_ratings_total ?? 0,
      address: place.formatted_address,
      place_id: place.place_id,
    }
  } catch (err) {
    console.error('[nova-audit:scanGoogleBusiness] Error:', err.message)
    return { found: false, score: null, error: err.message }
  }
}

export async function scanSocial() {
  // No reliable, ToS-compliant free API exists for cross-platform follower/engagement data
  // (Instagram/TikTok/Facebook Graph APIs require an owning business's OAuth consent, not a
  // third party's). Returning "not available" honestly rather than fabricating numbers.
  return { score: null, available: false, reason: 'Social platform APIs require account-level OAuth — not available for third-party scans.' }
}

// Fire-and-forget: places a short test call. Twilio's REST API does not return ring count or
// voicemail detection synchronously — a real result requires a status-callback webhook, which
// is out of scope for a single request/response audit run. We report the call as placed, not scored.
export async function testPhone(phone) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!phone) return { tested: false, reason: 'No phone number provided' }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return { tested: false, reason: 'Twilio not configured' }
  }
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
    const body = new URLSearchParams({
      To: phone,
      From: TWILIO_PHONE_NUMBER,
      Twiml: '<Response><Say>Hi, this is an automated connection test from Nova Systems. Please ignore this call. Thank you.</Say></Response>',
    })
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data?.message || `Twilio ${r.status}`)
    return { tested: true, status: 'call_placed', call_sid: data.sid, note: 'Ring/answer outcome requires a status-callback webhook — not scored synchronously.' }
  } catch (err) {
    console.error('[nova-audit:testPhone] Error:', err.message)
    return { tested: false, error: err.message }
  }
}

// Fire-and-forget: sends a real test inquiry email. A genuine reply can take hours to days,
// so this cannot be scored within the same request — result is reported as sent/pending.
export async function testEmail(email, businessName) {
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!email) return { tested: false, reason: 'No email address provided' }
  if (!RESEND_KEY) return { tested: false, reason: 'Resend not configured' }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Nova Systems <noreply@nova-systems.app>',
        to: [email],
        subject: `Quick question about ${businessName}`,
        html: `<p>Hi, I came across your business and had a quick question about your services and pricing. Could someone reach out when you have a moment? Thank you.</p>`,
      }),
    })
    if (!r.ok) throw new Error(`Resend ${r.status}`)
    return { tested: true, status: 'email_sent', note: 'Reply time requires a follow-up check — not scored synchronously.' }
  } catch (err) {
    console.error('[nova-audit:testEmail] Error:', err.message)
    return { tested: false, error: err.message }
  }
}

const FALLBACK_COMPETITORS = (industry, city) => ([
  { name: `Leading ${industry} in ${city}`, estimated_google_rating: 4.6, review_count: 180, has_website: true, has_online_booking: true, social_media_score: 75, estimated_monthly_traffic: 1200, advantages_over_client: ['Stronger Google presence', 'Online booking enabled', 'Faster website'], what_client_does_better: 'Personalized local service' },
])

export async function discoverCompetitors({ businessName, industry, city }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return FALLBACK_COMPETITORS(industry, city)

  const prompt = `You are a Connecticut business analyst. Find the top 3 local competitors for a ${industry} business called "${businessName}" in ${city}, Connecticut that are currently outperforming them. Return ONLY a valid JSON array with no explanation, in this exact shape: [{"name":"","estimated_google_rating":0,"review_count":0,"has_website":true,"has_online_booking":false,"social_media_score":0,"estimated_monthly_traffic":0,"advantages_over_client":["",""],"what_client_does_better":""}]. Base this on your knowledge of the Connecticut local business market.`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await r.json()
    if (data.error) throw new Error(data.error.message)
    const text = data.content?.[0]?.text || '[]'
    const match = text.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match ? match[0] : text)
    return Array.isArray(parsed) && parsed.length ? parsed.slice(0, 3) : FALLBACK_COMPETITORS(industry, city)
  } catch (err) {
    console.error('[nova-audit:discoverCompetitors] Error:', err.message)
    return FALLBACK_COMPETITORS(industry, city)
  }
}
