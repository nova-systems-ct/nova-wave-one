import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { scanWebsite, scanGoogleBusiness, scanWebsiteFeatures, testPhone, testEmail, discoverCompetitors } from './_scans.js'
import { calculateRevenueLeak, overallScore, scoreLabel, competitiveScore } from './_leak.js'
import { brandScore, storefrontScore, leadCaptureScore, customerExperienceScore, aiReadinessScore, buildPriorityRoadmap } from './_categories.js'
import { buildAuditPdf } from './_pdf.js'
import { buildPitchDeck } from './_pptx.js'

// Columns that are guaranteed to exist even on a database that hasn't had schema.sql re-run
// for the newest columns yet (see supabase/schema.sql — it's idempotent, but only once someone
// actually runs it). Used as the fallback insert so a missing-column error never loses the
// whole audit result — better to save a partial record than none at all.
const SAFE_COLUMNS = [
  'business_name', 'website', 'phone', 'email', 'owner_name', 'city', 'industry',
  'overall_score', 'score_label', 'revenue_leak_monthly', 'revenue_leak_annual',
  'competitor_data', 'key_findings', 'outreach_status', 'created_at',
]

function pickSafeColumns(record) {
  const out = {}
  for (const key of SAFE_COLUMNS) if (key in record) out[key] = record[key]
  return out
}

async function saveAuditRecord(auditRecord) {
  if (!isSupabaseConfigured()) return null
  try {
    const r = await supabaseFetch('nova_ai_audits', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(auditRecord),
    })
    if (r.ok) { const rows = await r.json(); return rows[0]?.id || null }
    console.error('[nova-audit] Full save failed, retrying with safe column set:', r.status, await r.text())
  } catch (err) {
    console.error('[nova-audit] Full save error, retrying with safe column set:', err.message)
  }

  try {
    const r2 = await supabaseFetch('nova_ai_audits', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(pickSafeColumns(auditRecord)),
    })
    if (r2.ok) { const rows = await r2.json(); return rows[0]?.id || null }
    console.error('[nova-audit] Safe-column save also failed:', r2.status, await r2.text())
  } catch (err) {
    console.error('[nova-audit] Safe-column save error (continuing — result still returned to frontend):', err.message)
  }
  return null
}

// Logs which environment variables are present (never their values) at the start of every
// audit, so a run that silently falls back to defaults is traceable in the Vercel function logs
// instead of looking identical to a fully-configured run.
function checkEnvAndWarn() {
  const checks = [
    ['GOOGLE_API_KEY', process.env.GOOGLE_API_KEY, 'website and Google Business scans will use defaults'],
    ['ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY, 'competitor discovery will use real Connecticut business name fallbacks'],
    ['TWILIO_ACCOUNT_SID', process.env.TWILIO_ACCOUNT_SID, 'phone test will be skipped'],
    ['TWILIO_AUTH_TOKEN', process.env.TWILIO_AUTH_TOKEN, 'phone test will be skipped'],
    ['TWILIO_PHONE_NUMBER', process.env.TWILIO_PHONE_NUMBER, 'phone test will be skipped'],
    ['RESEND_API_KEY', process.env.RESEND_API_KEY, 'email test and delivery will be skipped'],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, 'audit will not be saved'],
  ]
  const present = checks.filter(([, val]) => !!val).map(([name]) => name)
  const missing = checks.filter(([, val]) => !val)
  console.log(`[nova-audit] Env check — present: [${present.join(', ') || 'none'}]`)
  for (const [name, , consequence] of missing) {
    console.warn(`[nova-audit] ${name} is missing — ${consequence}.`)
  }
}

// Ties each under-70 category to the matching dollar figure from the revenue leak breakdown,
// so every finding is both specific and dollar-focused, sorted with the biggest leak first.
function buildFindings({ business_name, scores, revenueLeak, fcp, googleBiz, competitors }) {
  const candidates = []

  if (scores.website == null || scores.website < 70) {
    const problem = scores.website == null
      ? `${business_name} has no measurable website performance data on file`
      : `Your website takes ${fcp || 'several seconds'} to load on mobile`
    candidates.push({ text: problem, amount: revenueLeak.breakdown.website_abandonment })
  }
  if (scores.google < 70) {
    const problem = !googleBiz.found
      ? `${business_name} has no Google Business profile — you are invisible to customers searching locally right now`
      : `Your Google Business profile is incomplete or under-optimized`
    candidates.push({ text: problem, amount: revenueLeak.breakdown.google_visibility })
  }
  if (scores.phone < 70) {
    candidates.push({ text: 'Our test call to your number did not clearly connect', amount: revenueLeak.breakdown.missed_calls })
  }
  if (scores.social < 70) {
    candidates.push({ text: 'Your social media presence is thin, so DMs and comments are likely going unanswered', amount: revenueLeak.breakdown.social_engagement })
  }
  if (scores.leadCapture < 70) {
    candidates.push({ text: 'Contacts across phone, email, and your website form are not being captured consistently', amount: revenueLeak.breakdown.lead_capture })
  }
  if (scores.customerExperience < 70) {
    candidates.push({ text: 'There is no visible booking system, loyalty program, or follow-up process on your website', amount: revenueLeak.breakdown.customer_retention })
  }

  candidates.sort((a, b) => (b.amount || 0) - (a.amount || 0))
  const findings = candidates.slice(0, 5).map((c) => `${c.text}. This is costing you an estimated $${(c.amount || 0).toLocaleString()} per month.`)

  if (competitors[0]) {
    const advantages = Array.isArray(competitors[0].advantages) ? competitors[0].advantages.slice(0, 2).join(' and ') : 'a stronger online presence'
    findings.push(`${competitors[0].name} is currently outperforming you with ${advantages}.`)
  }

  const gapCount = Object.values(revenueLeak.breakdown).filter((v) => v > 0).length
  findings.push(`We estimate you are losing $${revenueLeak.monthly.toLocaleString()} per month in recoverable revenue across ${gapCount} identified gap${gapCount === 1 ? '' : 's'}.`)

  return findings
}

async function handleRunAudit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  checkEnvAndWarn()

  const b = req.body || {}
  const business_name = sanitize(b.business_name, 200)
  const website_url = b.website_url ? sanitizeUrl(b.website_url) : ''
  const phone = b.phone ? sanitizePhone(b.phone) : ''
  const email = b.email ? sanitizeEmail(b.email) : ''
  const owner_name = sanitize(b.owner_name, 100)
  const city = sanitize(b.city, 80)
  const industry = sanitize(b.industry, 80)
  const tier = b.tier === 'free' ? 'free' : 'full' // the dashboard always runs full; a public page would pass tier: 'free'

  if (!business_name || !city || !industry) {
    return res.status(400).json({ error: 'business_name, city, and industry are required' })
  }

  // Cache check (same website, last 7 days)
  if (website_url && isSupabaseConfigured()) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const r = await supabaseFetch(`nova_ai_audits?website=eq.${encodeURIComponent(website_url)}&created_at=gte.${weekAgo}&order=created_at.desc&limit=1`)
      const rows = r.ok ? await r.json() : []
      if (rows[0]) return res.status(200).json({ ...rows[0], audit_id: rows[0].id, cached: true })
    } catch (err) {
      console.error('[nova-audit] Cache check failed (non-fatal):', err.message)
    }
  }

  // Core scans always run (free and full). Phone/email tests only run on the full tier — they
  // cost real money (a real call, a real send) and the free tier is meant to be free to offer.
  const scanPromises = [
    scanWebsite(website_url),
    scanGoogleBusiness({ businessName: business_name, city }),
    scanWebsiteFeatures(website_url),
    discoverCompetitors({ businessName: business_name, industry, city }),
  ]
  if (tier === 'full') {
    scanPromises.push(testPhone(phone), testEmail(email, business_name))
  }
  const [websiteScan, googleBiz, features, competitors, phoneTest, emailTest] = await Promise.all(scanPromises)

  const social = features.social
  const google_rating = googleBiz.rating ?? null
  const google_reviews = googleBiz.reviews ?? null

  // Website performance falls back to 0 (not excluded), matching the original scoring spec.
  const website_score = website_url ? (websiteScan.performance_score ?? 0) : 0
  const google_score = googleBiz.score
  const social_score = social.score
  const phone_score = tier === 'full' ? phoneTest.phone_score : null
  const email_score = tier === 'full' ? emailTest.email_score : null
  const competitive_score = competitiveScore(competitors)

  const brand_score = brandScore({
    hasWebsite: !!website_url,
    googleBusinessNameMatches: googleBiz.found && googleBiz.name && business_name && googleBiz.name.toLowerCase().includes(business_name.toLowerCase().split(' ')[0]),
    hasLogo: features.hasLogo,
    hasSocialPresence: social.platforms.length > 0,
    email,
  })
  const storefront_score = storefrontScore({ googleFound: googleBiz.found, photoCount: googleBiz.photo_count, rating: googleBiz.rating, hasHours: !!googleBiz.opening_hours })
  const lead_capture_score = leadCaptureScore({
    phoneTested: tier === 'full' && !!phoneTest?.tested, phoneCallStatus: phoneTest?.status,
    emailTested: tier === 'full' && !!emailTest?.tested, hasContactForm: features.hasContactForm,
  })
  const customer_experience_score = customerExperienceScore({
    hasWebsite: !!website_url, hasBookingWidget: features.hasBookingWidget,
    hasLoyaltyMention: features.hasLoyaltyMention, hasFAQ: features.hasFAQ, hasTestimonials: features.hasTestimonials,
  })
  const ai_readiness_score = aiReadinessScore({ phoneScore: phone_score, emailScore: email_score, socialScore: social_score, customerExperienceScore: customer_experience_score })

  const overall_score = overallScore({
    website: website_score, google: google_score, phone: phone_score, email: email_score, social: social_score, competitive: competitive_score,
  })

  const revenueLeak = calculateRevenueLeak({
    industry, phoneScore: phone_score, performanceScore: websiteScan.performance_score, googleScore: google_score,
    socialScore: social_score, leadCaptureScore: lead_capture_score, customerExperienceScore: customer_experience_score,
  })

  const scoresForFindings = { website: website_score, google: google_score, phone: phone_score ?? 50, social: social_score, leadCapture: lead_capture_score, customerExperience: customer_experience_score }
  const key_findings = buildFindings({ business_name, scores: scoresForFindings, revenueLeak, fcp: websiteScan.fcp, googleBiz, competitors })

  const priority_roadmap = buildPriorityRoadmap({
    scores: { google: google_score, leadCapture: lead_capture_score, brand: brand_score, phone: phone_score ?? 50, email: email_score ?? 70, website: website_score, social: social_score, storefront: storefront_score, customerExperience: customer_experience_score },
    revenueLeak, businessName: business_name,
  })

  const auditRecord = {
    business_name, website: website_url || null, phone: phone || null, email: email || null,
    owner_name: owner_name || null, city, industry, tier,
    performance_score: website_score, google_score, phone_score, email_score,
    social_score, competitive_score, brand_score, storefront_score,
    lead_capture_score, customer_experience_score, ai_readiness_score,
    overall_score, score_label: scoreLabel(overall_score),
    revenue_leak_monthly: revenueLeak.monthly, revenue_leak_annual: revenueLeak.annual,
    revenue_leak_breakdown: revenueLeak.breakdown,
    competitor_data: competitors, key_findings, priority_roadmap,
    phone_test_result: tier === 'full' ? phoneTest : null,
    email_test_result: tier === 'full' ? emailTest : null,
    google_rating, google_reviews,
    outreach_status: 'pending', created_at: new Date().toISOString(),
    // Cross-engine trigger: every completed audit immediately enters the Nova Revive pipeline
    // at temperature Hot (0 days since contact — the audit itself is the first contact), so
    // Nova Revive's check_all_leads picks it up automatically without any separate insert.
    opted_out: false, lead_temperature: 'Hot', days_since_contact: 0,
  }

  // PDF and pitch deck are a full-tier feature — the free tier is meant to be genuinely free to run.
  let pdf_data = null, pitch_deck_data = null
  if (tier === 'full') {
    try { pdf_data = buildAuditPdf(auditRecord) } catch (err) { console.error('[nova-audit] PDF generation failed (continuing without it):', err.message) }
    try { pitch_deck_data = await buildPitchDeck(auditRecord) } catch (err) { console.error('[nova-audit] Pitch deck generation failed (continuing without it):', err.message) }
  }
  auditRecord.pdf_data = pdf_data
  auditRecord.pitch_deck_data = pitch_deck_data

  const savedId = await saveAuditRecord(auditRecord)

  // Delivery is a full-tier feature.
  if (tier === 'full') {
    if (phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            To: phone, From: process.env.TWILIO_PHONE_NUMBER,
            Body: `Hey ${owner_name || 'there'}, Isaac here from Nova Systems. Your Nova Intelligence Report for ${business_name} just came in. Score: ${overall_score}/100. We found $${revenueLeak.monthly.toLocaleString()} in monthly recoverable revenue. Check your email for the full report. Book a free meeting: nova-systems.app/welcome.`,
          }).toString(),
        })
      } catch (err) { console.error('[nova-audit] SMS delivery failed (non-fatal):', err.message) }
    }
    if (email && process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Nova Systems <noreply@nova-systems.app>',
            to: [email],
            subject: `Your Nova Intelligence Report — ${business_name} — ${overall_score}/100`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
              <div style="background:#080808;padding:24px;text-align:center;"><span style="color:#C8A96E;font-weight:900;letter-spacing:2px;">NOVA SYSTEMS</span></div>
              <div style="padding:28px;border:1px solid #eee;border-top:none;">
                <h2>Your score: ${overall_score}/100 — ${scoreLabel(overall_score)}</h2>
                <p>Estimated annual revenue being lost: <strong>$${revenueLeak.annual.toLocaleString()}</strong></p>
                <ul>${key_findings.map((f) => `<li>${f}</li>`).join('')}</ul>
                <p><a href="https://nova-systems.app/welcome" style="background:#C8A96E;color:#080808;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Book Your Free Strategy Meeting</a></p>
              </div></div>`,
          }),
        })
      } catch (err) { console.error('[nova-audit] Email delivery failed (non-fatal):', err.message) }
    }
  }

  return res.status(200).json({ ...auditRecord, audit_id: savedId })
}

async function handleGetAudits(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_ai_audits?order=created_at.desc&limit=200')
  return res.status(200).json(r.ok ? await r.json() : [])
}

async function handleGetAudit(req, res) {
  const id = sanitize(req.query?.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isSupabaseConfigured()) return res.status(404).json(null)
  const r = await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(id)}&limit=1`)
  const rows = r.ok ? await r.json() : []
  return res.status(200).json(rows[0] || null)
}

async function handleUpdateStatus(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  const patch = {}
  if (b.status) patch.outreach_status = sanitize(b.status, 30)
  if (typeof b.meeting_booked === 'boolean') patch.meeting_booked = b.meeting_booked
  if (typeof b.became_client === 'boolean') patch.became_client = b.became_client

  // Cross-engine trigger: marking a lead as a client stops all future Nova Revive outreach
  // (Revive's queries already filter on became_client=false) and sends a real welcome email.
  if (patch.became_client === true) {
    patch.outreach_status = 'client'
    if (isSupabaseConfigured()) {
      try {
        const existing = await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(id)}&limit=1`)
        const lead = existing.ok ? (await existing.json())[0] : null
        if (lead?.email && process.env.RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Nova Systems <hello@nova-systems.app>',
              to: [lead.email],
              subject: `Welcome to Nova Systems, ${lead.business_name || 'friend'}!`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
                <div style="background:#080808;padding:24px;text-align:center;"><span style="color:#C8A96E;font-weight:900;letter-spacing:2px;">NOVA SYSTEMS</span></div>
                <div style="padding:28px;border:1px solid #eee;border-top:none;">
                  <h2>Welcome aboard, ${lead.owner_name || lead.business_name}!</h2>
                  <p>We're excited to start working with ${lead.business_name} on recovering that $${(lead.revenue_leak_monthly || 0).toLocaleString()}/month in revenue leaks we found in your audit. Isaac will be in touch shortly with next steps.</p>
                </div></div>`,
            }),
          })
        }
      } catch (err) {
        console.error('[nova-audit:update_status] Welcome email failed (non-fatal):', err.message)
      }
    }
  }

  const r = await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  })
  if (!r.ok) return res.status(500).json({ error: 'Update failed' })
  return res.status(200).json({ ok: true })
}

async function handleResend(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(id)}&limit=1`)
  const audit = r.ok ? (await r.json())[0] : null
  if (!audit) return res.status(404).json({ error: 'Audit not found' })

  let smsOk = false, emailOk = false
  if (audit.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          To: audit.phone, From: process.env.TWILIO_PHONE_NUMBER,
          Body: `Hey ${audit.owner_name || 'there'}, Isaac here from Nova Systems — resending your Nova Intelligence Report for ${audit.business_name}. Score: ${audit.overall_score}/100, $${(audit.revenue_leak_annual || 0).toLocaleString()}/yr recoverable. Check your email for the full report.`,
        }).toString(),
      })
      smsOk = smsRes.ok
    } catch (err) { console.error('[nova-audit:resend] SMS failed (non-fatal):', err.message) }
  }
  if (audit.email && process.env.RESEND_API_KEY) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Nova Systems <noreply@nova-systems.app>',
          to: [audit.email],
          subject: `Your Nova Intelligence Report — ${audit.business_name} — ${audit.overall_score}/100`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
            <div style="background:#080808;padding:24px;text-align:center;"><span style="color:#C8A96E;font-weight:900;letter-spacing:2px;">NOVA SYSTEMS</span></div>
            <div style="padding:28px;border:1px solid #eee;border-top:none;">
              <h2>Your score: ${audit.overall_score}/100 — ${audit.score_label}</h2>
              <p>Estimated annual revenue being lost: <strong>$${(audit.revenue_leak_annual || 0).toLocaleString()}</strong></p>
              <ul>${(audit.key_findings || []).map((f) => `<li>${f}</li>`).join('')}</ul>
              <p><a href="https://nova-systems.app/welcome" style="background:#C8A96E;color:#080808;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Book Your Free Strategy Meeting</a></p>
            </div></div>`,
        }),
      })
      emailOk = emailRes.ok
    } catch (err) { console.error('[nova-audit:resend] Email failed (non-fatal):', err.message) }
  }

  await supabaseFetch(`nova_ai_audits?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ outreach_status: 'resent' }) }).catch(() => {})
  return res.status(200).json({ ok: true, smsOk, emailOk })
}

async function handleBulkScan(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const industry = sanitize(b.industry, 80)
  const city = sanitize(b.city, 80)
  const maxResults = Math.min(100, Math.max(10, parseInt(b.max_results, 10) || 30))
  const key = process.env.GOOGLE_API_KEY
  if (!key) return res.status(500).json({ error: 'GOOGLE_API_KEY is not configured' })

  try {
    const query = `${industry} in ${city} Connecticut`
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`
    const r = await fetch(url)
    const data = await r.json()
    const companies = (data?.results || [])
      .filter((p) => (p.rating || 0) < 4.8) // skip businesses that likely already have things dialed in
      .slice(0, maxResults)
      .map((p) => ({
        name: p.name, address: p.formatted_address, google_rating: p.rating ?? null,
        review_count: p.user_ratings_total ?? null, place_id: p.place_id,
      }))
    return res.status(200).json({ companies })
  } catch (err) {
    console.error('[nova-audit:bulk_scan] Error:', err.message)
    return res.status(500).json({ error: 'Bulk scan failed' })
  }
}

async function handleRunBulkAudits(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const companies = Array.isArray(b.companies) ? b.companies : []
  const industry = sanitize(b.industry, 80)
  const city = sanitize(b.city, 80)
  if (!companies.length) return res.status(400).json({ error: 'companies array is required' })

  const results = []
  for (const c of companies) {
    try {
      const fakeReq = { method: 'POST', body: { business_name: c.name, city, industry, phone: '', email: '', website_url: '', tier: 'full' } }
      const fakeRes = { status: () => fakeRes, json: (d) => { results.push(d); return d } }
      await handleRunAudit(fakeReq, fakeRes)
    } catch (err) {
      console.error('[nova-audit:run_bulk_audits] Failed for', c.name, err.message)
    }
    await new Promise((resolve) => setTimeout(resolve, 3000)) // 3s between each to avoid rate limiting
  }

  return res.status(200).json({ ok: true, completed: results.length })
}

// Top-level safety net — guarantees a JSON response is always sent, even if something in an
// action handler throws in a way none of its own try/catches anticipated. Vercel functions that
// crash without calling res.end() just hang until the platform times them out, which looks
// identical to "broken" from the frontend — this turns that into a real, immediate 500.
export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'run_audit':          return await handleRunAudit(req, res)
      case 'get_audits':         return await handleGetAudits(req, res)
      case 'get_audit':          return await handleGetAudit(req, res)
      case 'update_audit_status': return await handleUpdateStatus(req, res)
      case 'resend':               return await handleResend(req, res)
      case 'bulk_scan':             return await handleBulkScan(req, res)
      case 'run_bulk_audits':       return await handleRunBulkAudits(req, res)
      default:
        if (req.method === 'GET' && !action) return await handleGetAudits(req, res)
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[nova-audit] Unhandled error:', err)
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Something went wrong running the audit. Please try again. If the problem continues contact hello@nova-systems.app.' })
    }
  }
}
