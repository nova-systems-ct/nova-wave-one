export const AVG_TRANSACTION = {
  'Restaurant': 45,
  'Barbershop': 35,
  'Barbershop and Salon': 35,
  'Salon': 35,
  'Medical': 200,
  'Medical and Dental': 190,
  'Dental': 180,
  'Law': 500,
  'Law and Finance': 450,
  'Finance': 400,
  'Real Estate': 3000,
  'Contractor': 1500,
  'Contractor and Trade': 1500,
  'Retail Store': 80,
  'Retail': 80,
  'Auto Shop': 250,
  'Gym': 100,
  'Gym and Fitness': 100,
  'Food Truck': 25,
  'Convenience Store': 15,
  'Nutrition Bar': 8,
  'Jewelry Store': 300,
  'Print and Graphics Shop': 150,
  'Technology': 250,
  'Professional Services': 300,
  'Other': 100,
}

export function avgTransaction(industry) {
  return AVG_TRANSACTION[industry] || AVG_TRANSACTION.Other
}

export function missedCallsPerWeek(phoneScore) {
  if (phoneScore == null) return 20
  if (phoneScore < 40) return 25
  if (phoneScore < 60) return 20
  if (phoneScore < 80) return 12
  return 8
}

export function webLossPct(performanceScore) {
  if (performanceScore == null) return 0.80
  if (performanceScore < 50) return 0.53
  if (performanceScore < 70) return 0.25
  return 0.10
}

// Baseline monthly volume assumptions used by the percentage-based leak formulas below —
// industry-agnostic placeholders (same role as the "500 estimated monthly visitors" and
// "200 estimated monthly searches" constants already in use), not a per-business measurement.
const ESTIMATED_MONTHLY_CONTACTS = 40
const ESTIMATED_MONTHLY_CUSTOMERS = 60

export function calculateRevenueLeak({ industry, phoneScore, performanceScore, googleScore, socialScore, leadCaptureScore, customerExperienceScore }) {
  const avg = avgTransaction(industry)

  const missedCalls = missedCallsPerWeek(phoneScore)
  const monthlyCallLeak = missedCalls * 4 * avg * 0.25

  const lossPct = webLossPct(performanceScore)
  const monthlyWebLeak = 500 * lossPct * avg * 0.08

  // Google visibility leak — under 60, an estimated 30% of local search traffic goes to competitors.
  const googleLossPct = (googleScore != null && googleScore < 60) ? 0.30 : 0
  const monthlyGoogleLeak = 200 * googleLossPct * avg * 0.15

  // Social engagement leak — under 50, an estimated 15 leads/month go cold from ignored DMs/comments.
  const coldLeads = (socialScore != null && socialScore < 50) ? 15 : 0
  const monthlySocialLeak = coldLeads * avg * 0.20

  // Lead capture leak — under 60, an estimated 25% of contacts go unanswered across all channels.
  const unansweredPct = (leadCaptureScore != null && leadCaptureScore < 60) ? 0.25 : 0
  const monthlyLeadCaptureLeak = ESTIMATED_MONTHLY_CONTACTS * unansweredPct * avg * 0.30

  // Customer retention leak — under 60, an estimated 20% of customers never return.
  const churnPct = (customerExperienceScore != null && customerExperienceScore < 60) ? 0.20 : 0
  const monthlyRetentionLeak = ESTIMATED_MONTHLY_CUSTOMERS * churnPct * avg

  const totalMonthly = Math.round((monthlyCallLeak + monthlyWebLeak + monthlyGoogleLeak + monthlySocialLeak + monthlyLeadCaptureLeak + monthlyRetentionLeak) / 100) * 100
  const totalAnnual = totalMonthly * 12

  return {
    breakdown: {
      missed_calls: Math.round(monthlyCallLeak),
      website_abandonment: Math.round(monthlyWebLeak),
      google_visibility: Math.round(monthlyGoogleLeak),
      social_engagement: Math.round(monthlySocialLeak),
      lead_capture: Math.round(monthlyLeadCaptureLeak),
      customer_retention: Math.round(monthlyRetentionLeak),
    },
    monthly: totalMonthly,
    annual: totalAnnual,
  }
}

export function scoreLabel(score) {
  if (score <= 40) return 'Critical — Immediate Action Required'
  if (score <= 60) return 'Poor — Significant Gaps Detected'
  if (score <= 75) return 'Fair — Room for Improvement'
  if (score <= 85) return 'Good — Optimization Available'
  return 'Strong — Fine Tuning Needed'
}

export function competitiveScore(competitors) {
  if (!competitors?.length) return 50
  const avgRating = competitors.reduce((s, c) => s + (Number(c.estimated_google_rating) || 0), 0) / competitors.length
  return Math.max(0, Math.min(60, 100 - avgRating * 20))
}

export function overallScore({ website, google, phone, email, social, competitive }) {
  const weighted =
    (website ?? 0) * 0.25 +
    (google ?? 0) * 0.20 +
    (phone ?? 0) * 0.20 +
    (email ?? 0) * 0.15 +
    (social ?? 0) * 0.10 +
    (competitive ?? 0) * 0.10
  return Math.round(weighted)
}
