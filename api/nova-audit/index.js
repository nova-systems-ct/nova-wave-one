import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail, sanitizePhone, sanitizeUrl } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { scanWebsite, scanGoogleBusiness, scanSocial, testPhone, testEmail, discoverCompetitors } from './_scans.js'
import { calculateRevenueLeak, overallScore, scoreLabel, competitiveScore } from './_leak.js'
import { buildAuditPdf } from './_pdf.js'
import { buildPitchDeck } from './_pptx.js'

function checkEnvAndWarn() {
  if (!process.env.GOOGLE_API_KEY) console.warn('[nova-audit] GOOGLE_API_KEY is missing — website and Google Business scans will use defaults.')
  if (!process.env.ANTHROPIC_API_KEY) console.warn('[nova-audit] ANTHROPIC_API_KEY is missing — competitor discovery will use fallback data.')
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) console.warn('[nova-audit] Twilio credentials are incomplete — phone test will be skipped.')
  if (!process.env.RESEND_API_KEY) console.warn('[nova-audit] RESEND_API_KEY is missing — email test and delivery will be skipped.')
}

function buildFindings({ business_name, website, googleBiz, revenueLeak, performanceScore, phoneScore, googleScore, fcp, competitors }) {
  const findings = []

  if (performanceScore != null && performanceScore < 50) {
    findings.push(`Your website takes ${fcp || 'several seconds'} to load on mobile. You are losing an estimated 53% of visitors before they see your phone number.`)
  } else if (!website) {
    findings.push(`${business_name} has no website on file, which typically means losing an estimated 80% of potential online leads.`)
  } else if (performanceScore != null && performanceScore < 70) {
    findings.push(`Your website scores ${performanceScore}/100 on mobile — roughly a quarter of mobile visitors are dropping off before converting.`)
  }

  if (phoneScore != null && phoneScore < 40) {
    findings.push(`Our test call to your number went unanswered. Every missed call is a potential customer calling your competitor.`)
  }

  if (googleScore != null && googleScore < 40) {
    findings.push(`Your Google Business profile is incomplete or missing. You are invisible to customers searching locally right now.`)
  } else if (googleBiz.found && (googleBiz.reviews || 0) < 10) {
    findings.push(`Your Google Business profile has only ${googleBiz.reviews || 0} reviews, which lowers your discovery rate against local competitors.`)
  }

  if (competitors[0]) {
    const advantages = Array.isArray(competitors[0].advantages) ? competitors[0].advantages.slice(0, 2).join(' and ') : 'a stronger online presence'
    findings.push(`${competitors[0].name} is currently outperforming you with ${advantages}.`)
  }

  const gapCount = Object.values(revenueLeak.breakdown).filter((v) => v > 0).length
  findings.push(`We estimate you are losing $${revenueLeak.monthly.toLocaleString()} per month in recoverable revenue across ${gapCount} identified gap${gapCount === 1 ? '' : 's'}.`)

  return findings.slice(0, 5)
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

  if (!business_name || !city || !industry) {
    return res.status(400).json({ error: 'business_name, city, and industry are required' })
  }

  // Step 1 — cache check (same website, last 7 days)
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

  // Steps 2-6 — run every scan in parallel; each one fails soft with a documented default.
  const [websiteScan, googleBiz, social, phoneTest, emailTest, competitors] = await Promise.all([
    scanWebsite(website_url),
    scanGoogleBusiness({ businessName: business_name, city }),
    scanSocial(website_url),
    testPhone(phone),
    testEmail(email, business_name),
    discoverCompetitors({ businessName: business_name, industry, city }),
  ])

  const google_rating = googleBiz.rating ?? null
  const google_reviews = googleBiz.reviews ?? null

  // Step 8 — scores (website_score falls back to 0, not excluded, per spec)
  const website_score = website_url ? (websiteScan.performance_score ?? 0) : 0
  const google_score = googleBiz.score
  const phone_score = phoneTest.phone_score
  const email_score = emailTest.email_score
  const social_score = social.score
  const competitive_score = competitiveScore(competitors)
  const overall_score = overallScore({
    website: website_score, google: google_score, phone: phone_score, email: email_score, social: social_score, competitive: competitive_score,
  })

  // Step 7 — revenue leak (pure math)
  const revenueLeak = calculateRevenueLeak({
    industry, phoneScore: phone_score, performanceScore: websiteScan.performance_score, googleScore: google_score,
  })

  // Step 9 — key findings
  const key_findings = buildFindings({
    business_name, website: website_url, googleBiz, revenueLeak,
    performanceScore: websiteScan.performance_score, phoneScore: phone_score, googleScore: google_score,
    fcp: websiteScan.fcp, competitors,
  })

  const auditRecord = {
    business_name, website: website_url || null, phone: phone || null, email: email || null,
    owner_name: owner_name || null, city, industry,
    performance_score: website_score, google_score, phone_score, email_score,
    social_score, competitive_score, overall_score, score_label: scoreLabel(overall_score),
    revenue_leak_monthly: revenueLeak.monthly, revenue_leak_annual: revenueLeak.annual,
    revenue_leak_breakdown: revenueLeak.breakdown,
    competitor_data: competitors, key_findings,
    phone_test_result: phoneTest, email_test_result: emailTest,
    google_rating, google_reviews,
    outreach_status: 'pending', created_at: new Date().toISOString(),
  }

  // Step 10 — generate PDF + pitch deck
  let pdf_data = null, pitch_deck_data = null
  try { pdf_data = buildAuditPdf(auditRecord) } catch (err) { console.error('[nova-audit] PDF generation failed (continuing without it):', err.message) }
  try { pitch_deck_data = await buildPitchDeck(auditRecord) } catch (err) { console.error('[nova-audit] Pitch deck generation failed (continuing without it):', err.message) }

  auditRecord.pdf_data = pdf_data
  auditRecord.pitch_deck_data = pitch_deck_data

  // Step 11 — save
  let savedId = null
  if (isSupabaseConfigured()) {
    try {
      const r = await supabaseFetch('nova_ai_audits', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(auditRecord),
      })
      if (r.ok) { const rows = await r.json(); savedId = rows[0]?.id }
      else console.error('[nova-audit] Save failed:', r.status, await r.text())
    } catch (err) {
      console.error('[nova-audit] Save error (continuing — result still returned to frontend):', err.message)
    }
  }

  // Step 12 — deliver
  if (phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          To: phone, From: process.env.TWILIO_PHONE_NUMBER,
          Body: `Hey ${owner_name || 'there'}, Isaac here from Nova Systems. Your free Business Intelligence Audit for ${business_name} just came in. Score: ${overall_score}/100. We found $${revenueLeak.monthly.toLocaleString()} in monthly recoverable revenue. Check your email for the full report. Book a free meeting: nova-systems.app/welcome.`,
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
          subject: `Your Nova Systems Business Audit — ${business_name} — ${overall_score}/100`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
            <div style="background:#080808;padding:24px;text-align:center;"><span style="color:#C8A96E;font-weight:900;letter-spacing:2px;">NOVA SYSTEMS</span></div>
            <div style="padding:28px;border:1px solid #eee;border-top:none;">
              <h2>Your score: ${overall_score}/100 — ${scoreLabel(overall_score)}</h2>
              <p>Estimated monthly revenue being lost: <strong>$${revenueLeak.monthly.toLocaleString()}</strong></p>
              <ul>${key_findings.map((f) => `<li>${f}</li>`).join('')}</ul>
              <p><a href="https://nova-systems.app/welcome" style="background:#C8A96E;color:#080808;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Book Your Free Strategy Meeting</a></p>
            </div></div>`,
        }),
      })
    } catch (err) { console.error('[nova-audit] Email delivery failed (non-fatal):', err.message) }
  }

  // Step 13 — return everything, including audit_id, so the frontend can redirect to the result page
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
          Body: `Hey ${audit.owner_name || 'there'}, Isaac here from Nova Systems — resending your audit for ${audit.business_name}. Score: ${audit.overall_score}/100, $${(audit.revenue_leak_monthly || 0).toLocaleString()}/mo recoverable. Check your email for the full report.`,
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
          subject: `Your Nova Systems Business Audit — ${audit.business_name} — ${audit.overall_score}/100`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
            <div style="background:#080808;padding:24px;text-align:center;"><span style="color:#C8A96E;font-weight:900;letter-spacing:2px;">NOVA SYSTEMS</span></div>
            <div style="padding:28px;border:1px solid #eee;border-top:none;">
              <h2>Your score: ${audit.overall_score}/100 — ${audit.score_label}</h2>
              <p>Estimated monthly revenue being lost: <strong>$${(audit.revenue_leak_monthly || 0).toLocaleString()}</strong></p>
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
      const fakeReq = { method: 'POST', body: { business_name: c.name, city, industry, phone: '', email: '', website_url: '' } }
      const fakeRes = { status: () => fakeRes, json: (d) => { results.push(d); return d } }
      await handleRunAudit(fakeReq, fakeRes)
    } catch (err) {
      console.error('[nova-audit:run_bulk_audits] Failed for', c.name, err.message)
    }
    await new Promise((resolve) => setTimeout(resolve, 3000)) // 3s between each to avoid rate limiting
  }

  return res.status(200).json({ ok: true, completed: results.length })
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''

  switch (action) {
    case 'run_audit':          return handleRunAudit(req, res)
    case 'get_audits':         return handleGetAudits(req, res)
    case 'get_audit':          return handleGetAudit(req, res)
    case 'update_audit_status': return handleUpdateStatus(req, res)
    case 'resend':               return handleResend(req, res)
    case 'bulk_scan':             return handleBulkScan(req, res)
    case 'run_bulk_audits':       return handleRunBulkAudits(req, res)
    default:
      if (req.method === 'GET' && !action) return handleGetAudits(req, res)
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}
