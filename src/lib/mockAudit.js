// Local-dev-only mock audit result. Vercel serverless functions (api/nova-audit) do not run
// under plain `vite dev`, so in development the audit form generates and stores one of these
// instead of calling the real API, letting the full result page be built/tested without a
// deployment. Production always calls the real API — see AuditHome.jsx's import.meta.env.DEV gate.

const STORAGE_PREFIX = 'nova_audit_mock_'

export function buildMockAudit(form) {
  const audit_id = `mock-audit-${Date.now().toString().slice(-6)}`
  return {
    audit_id,
    id: audit_id,
    business_name: form.business_name || 'Test Business',
    website: form.website_url || null,
    phone: form.phone || null,
    email: form.email || null,
    owner_name: form.owner_name || null,
    city: form.city || 'Waterbury',
    industry: form.industry || 'Other',
    tier: 'full',
    created_at: new Date().toISOString(),

    overall_score: 58,
    score_label: 'Poor — Significant Gaps Detected',
    revenue_leak_monthly: 4200,
    revenue_leak_annual: 50400,
    revenue_leak_breakdown: {
      missed_calls: 1600,
      website_abandonment: 1200,
      google_visibility: 400,
      social_engagement: 500,
      lead_capture: 300,
      customer_retention: 200,
    },

    performance_score: 45,
    google_score: 62,
    phone_score: 30,
    email_score: 70,
    social_score: 40,
    brand_score: 55,
    storefront_score: 50,
    lead_capture_score: 35,
    customer_experience_score: 45,
    ai_readiness_score: 75,
    competitive_score: 40,

    google_rating: 3.9,
    google_reviews: 14,

    competitor_data: [
      {
        name: 'Nutmeg Digital Solutions', estimated_google_rating: 4.7, review_count: 156,
        has_website: true, has_online_booking: true, social_score: 78,
        estimated_monthly_traffic: '1000-1500 visitors',
        advantages: ['Online booking enabled', 'Faster website', 'Active social media presence'],
        what_client_does_better: 'More personalized local service',
      },
      {
        name: 'Constitution State Consulting', estimated_google_rating: 4.4, review_count: 88,
        has_website: true, has_online_booking: false, social_score: 52,
        estimated_monthly_traffic: '500-800 visitors',
        advantages: ['Longer operating history', 'More Google reviews'],
        what_client_does_better: 'More modern branding',
      },
      {
        name: 'Brass City Business Services', estimated_google_rating: 4.2, review_count: 41,
        has_website: false, has_online_booking: false, social_score: 60,
        estimated_monthly_traffic: '200-400 visitors',
        advantages: ['Strong Instagram following'],
        what_client_does_better: 'Established website and online presence',
      },
    ],

    key_findings: [
      'Our test call to your number did not clearly connect. This is costing you an estimated $1,600 per month.',
      'Your website takes several seconds to load on mobile. This is costing you an estimated $1,200 per month.',
      'Your social media presence is thin, so DMs and comments are likely going unanswered. This is costing you an estimated $500 per month.',
      'Your Google Business profile is incomplete or under-optimized. This is costing you an estimated $400 per month.',
      'Contacts across phone, email, and your website form are not being captured consistently. This is costing you an estimated $300 per month.',
    ],

    priority_roadmap: {
      fix_today: [
        { action: 'Claim and complete your Google Business profile', impact: 'Could improve your Google score by up to 30 points', cost: 'Free', time: '1 hour' },
        { action: 'Set up a professional voicemail greeting', impact: 'Captures leads even when a call is missed', cost: 'Free', time: '15 minutes' },
        { action: 'Set up a professional business email address', impact: 'Improves brand credibility on every contact touchpoint', cost: 'Free to $6/month', time: '30 minutes' },
      ],
      fix_this_month: [
        { action: 'Deploy an AI phone agent', impact: 'Recover an estimated $1,600/month in missed calls', nova_service: 'Nova Voice', estimated_cost: 'Included in Wave One' },
        { action: 'Rebuild the website for speed and conversions', impact: 'Recover an estimated $1,200/month in website abandonment', nova_service: 'Nova Web', estimated_cost: 'Included in Wave One' },
        { action: 'Deploy AI social media management', impact: 'Recover an estimated $500/month in cold DMs and comments', nova_service: 'Nova Social', estimated_cost: 'Included in Wave One' },
        { action: 'Deploy an AI email assistant', impact: 'Recover an estimated $300/month in unanswered inquiries', nova_service: 'Nova Email', estimated_cost: 'Included in Wave One' },
      ],
      fix_this_quarter: [
        { action: 'Refresh exterior signage and storefront presence', impact: 'Estimated 15% increase in foot traffic', nova_service: 'Wave Two — Signage', estimated_cost: 'Quote required' },
        { action: 'Professional brand identity refresh', impact: 'Improves trust and conversion across every touchpoint', nova_service: 'Wave Two — Branding', estimated_cost: 'Quote required' },
        { action: 'Launch a loyalty and referral program', impact: 'Recover an estimated $200/month in customers who never return', nova_service: 'Wave Two — Operations', estimated_cost: 'Quote required' },
      ],
    },

    phone_test_result: { tested: true, status: 'no-answer', phone_score: 30 },
    email_test_result: { tested: true, status: 'email_sent', email_score: 70 },

    pdf_data: null, // per spec — dev mode never generates a real PDF
    pitch_deck_data: null,
    outreach_status: 'pending',
    meeting_booked: false,
    became_client: false,
  }
}

export function saveMockAudit(audit) {
  try { sessionStorage.setItem(STORAGE_PREFIX + audit.audit_id, JSON.stringify(audit)) } catch {}
}

export function getMockAudit(id) {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + id)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isMockAuditId(id) {
  return typeof id === 'string' && id.startsWith('mock-audit-')
}
