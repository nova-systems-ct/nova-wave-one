// Pure scoring logic for the 10 Nova Audit categories. No I/O here — every function takes the
// already-collected scan results from _scans.js and does arithmetic, matching the same
// separation _leak.js already uses (I/O in _scans.js, math everywhere else).

const FREE_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com']

// Category 1 — Brand Score
export function brandScore({ hasWebsite, googleBusinessNameMatches, hasLogo, hasSocialPresence, email }) {
  if (!hasWebsite) return 20 // default per spec when there's nothing to check
  let score = 20 // has a website with (at minimum) some consistent presence
  if (googleBusinessNameMatches) score += 20
  if (hasLogo) score += 20
  if (hasSocialPresence) score += 20
  const domain = (email || '').split('@')[1]?.toLowerCase()
  if (domain && !FREE_EMAIL_DOMAINS.includes(domain)) score += 20
  return Math.min(100, score)
}

// Category 2 — Storefront Score (uses Google Places photo/rating/hours data as a proxy for
// physical-location signal). Note: the Places API does not expose whether a business has
// responded to reviews, so that 20-point sub-check from the original spec is not scored here
// rather than being faked — see the comment on storefrontScore's caller in index.js.
export function storefrontScore({ googleFound, photoCount, rating, hasHours }) {
  if (!googleFound) return 40 // default per spec when Google Places data is unavailable
  let score = 0
  if ((photoCount || 0) > 10) score += 30
  if ((rating || 0) > 4.0) score += 30
  if (hasHours) score += 20
  return Math.min(100, score)
}

// Category 6 — Lead Capture Score
export function leadCaptureScore({ phoneTested, phoneCallStatus, emailTested, hasContactForm }) {
  if (!phoneTested && !emailTested) return 50 // default per spec when neither test ran

  let phonePoints = 0
  if (phoneCallStatus === 'completed' || phoneCallStatus === 'in-progress') phonePoints = 40 // answered
  else if (phoneCallStatus === 'no-answer' || phoneCallStatus === 'busy' || phoneCallStatus === 'failed') phonePoints = 0
  else phonePoints = phoneTested ? 20 : 0 // outcome unknown within the polling window — treat like voicemail

  const emailPoints = emailTested ? 30 : 0
  const formPoints = hasContactForm ? 30 : 0
  return Math.min(100, phonePoints + emailPoints + formPoints)
}

// Category 7 — Customer Experience Score
export function customerExperienceScore({ hasWebsite, hasBookingWidget, hasLoyaltyMention, hasFAQ, hasTestimonials }) {
  if (!hasWebsite) return 25 // default per spec
  let score = 0
  if (hasBookingWidget) score += 25
  if (hasLoyaltyMention) score += 25
  if (hasFAQ) score += 25
  if (hasTestimonials) score += 25
  return score
}

// Category 8 — AI Readiness Score. Higher = more AI could help (it's a measure of
// unaddressed gaps, not a measure of how "ready" the business already is).
export function aiReadinessScore({ phoneScore, emailScore, socialScore, customerExperienceScore }) {
  let score = 0
  if (phoneScore == null || phoneScore < 60) score += 25
  if (emailScore == null || emailScore < 70) score += 25
  if (socialScore == null || socialScore < 60) score += 25
  if (customerExperienceScore == null || customerExperienceScore < 50) score += 25
  return score
}

// Category 10 — Priority Roadmap. Pure logic, not a separate API call — built from whichever
// categories scored lowest.
export function buildPriorityRoadmap({ scores, revenueLeak, businessName }) {
  const fix_today = []
  const fix_this_month = []
  const fix_this_quarter = []

  if (scores.google < 70) {
    fix_today.push({ action: 'Claim and complete your Google Business profile', impact: 'Could improve your Google score by up to 30 points', cost: 'Free', time: '1 hour' })
  }
  if (scores.leadCapture < 60) {
    fix_today.push({ action: 'Set up a professional voicemail greeting', impact: 'Captures leads even when a call is missed', cost: 'Free', time: '15 minutes' })
  }
  if (scores.brand < 60) {
    fix_today.push({ action: 'Set up a professional business email address', impact: 'Improves brand credibility on every contact touchpoint', cost: 'Free to $6/month', time: '30 minutes' })
  }

  if (scores.phone < 70) {
    fix_this_month.push({ action: 'Deploy an AI phone agent', impact: `Recover an estimated $${(revenueLeak.breakdown.missed_calls || 0).toLocaleString()}/month in missed calls`, nova_service: 'Nova Voice', estimated_cost: 'Included in Wave One' })
  }
  if (scores.email < 80 || scores.leadCapture < 70) {
    fix_this_month.push({ action: 'Deploy an AI email assistant', impact: `Recover an estimated $${(revenueLeak.breakdown.lead_capture || 0).toLocaleString()}/month in unanswered inquiries`, nova_service: 'Nova Email', estimated_cost: 'Included in Wave One' })
  }
  if (scores.website == null || scores.website < 70) {
    fix_this_month.push({ action: 'Rebuild the website for speed and conversions', impact: `Recover an estimated $${(revenueLeak.breakdown.website_abandonment || 0).toLocaleString()}/month in website abandonment`, nova_service: 'Nova Web', estimated_cost: 'Included in Wave One' })
  }
  if (scores.social < 60) {
    fix_this_month.push({ action: 'Deploy AI social media management', impact: `Recover an estimated $${(revenueLeak.breakdown.social_engagement || 0).toLocaleString()}/month in cold DMs and comments`, nova_service: 'Nova Social', estimated_cost: 'Included in Wave One' })
  }

  if (scores.storefront < 60) {
    fix_this_quarter.push({ action: 'Refresh exterior signage and storefront presence', impact: 'Estimated 15% increase in foot traffic', nova_service: 'Wave Two — Signage', estimated_cost: 'Quote required' })
  }
  if (scores.brand < 60) {
    fix_this_quarter.push({ action: 'Professional brand identity refresh', impact: 'Improves trust and conversion across every touchpoint', nova_service: 'Wave Two — Branding', estimated_cost: 'Quote required' })
  }
  if (scores.customerExperience < 60) {
    fix_this_quarter.push({ action: 'Launch a loyalty and referral program', impact: `Recover an estimated $${(revenueLeak.breakdown.customer_retention || 0).toLocaleString()}/month in customers who never return`, nova_service: 'Wave Two — Operations', estimated_cost: 'Quote required' })
  }

  return { fix_today, fix_this_month, fix_this_quarter }
}
