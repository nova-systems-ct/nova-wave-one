export const AVG_TRANSACTION = {
  'Restaurant': 45,
  'Barbershop and Salon': 35,
  'Medical and Dental': 200,
  'Law and Finance': 500,
  'Real Estate': 3000,
  'Contractor and Trade': 1500,
  'Retail Store': 80,
  'Auto Shop': 250,
  'Gym and Fitness': 100,
  'Food Truck': 25,
  'Convenience Store': 15,
  'Nutrition Bar': 8,
  'Jewelry Store': 300,
  'Print and Graphics Shop': 150,
  'Other': 100,
}

export function avgTransaction(industry) {
  return AVG_TRANSACTION[industry] || AVG_TRANSACTION.Other
}

export function missedCallsPerWeek({ hasPhone, phoneTest }) {
  if (!hasPhone) return 20
  if (phoneTest?.answered === false && !phoneTest?.voicemail) return 25
  if (phoneTest?.voicemail && !phoneTest?.voicemail_set_up) return 25
  if (phoneTest?.voicemail) return 15
  return 5
}

export function webTrafficLossPct({ hasWebsite, performanceScore }) {
  if (!hasWebsite) return 0.8
  if (performanceScore == null) return 0.4
  if (performanceScore < 50) return 0.53
  if (performanceScore < 70) return 0.25
  return 0.1
}

export function calculateRevenueLeak({ industry, hasPhone, hasWebsite, phoneTest, performanceScore, googleReviews, emailRepliedWithin24h, hasEmail }) {
  const avg = avgTransaction(industry)
  const monthlyBase = avg * 30 // rough baseline used for percentage-based leaks below

  const missedCalls = missedCallsPerWeek({ hasPhone, phoneTest })
  const missedCallLeak = missedCalls * 4 * avg * 0.25

  const estimatedMonthlyVisitors = hasWebsite ? 400 : 0
  const lossPct = webTrafficLossPct({ hasWebsite, performanceScore })
  const webLeak = estimatedMonthlyVisitors * lossPct * avg * 0.10

  const googleLeak = (googleReviews == null || googleReviews < 10) ? monthlyBase * 0.20 : 0
  const emailLeak = (hasEmail && !emailRepliedWithin24h) ? monthlyBase * 0.15 : 0

  const totalMonthly = Math.round((missedCallLeak + webLeak + googleLeak + emailLeak) / 100) * 100
  const totalAnnual = totalMonthly * 12

  return {
    breakdown: {
      missed_calls: Math.round(missedCallLeak),
      website_abandonment: Math.round(webLeak),
      weak_google_presence: Math.round(googleLeak),
      slow_email_response: Math.round(emailLeak),
    },
    monthly: totalMonthly,
    annual: totalAnnual,
  }
}

export function scoreLabel(score) {
  if (score <= 40) return 'Critical — Immediate Action Required'
  if (score <= 60) return 'Poor — Significant Gaps Detected'
  if (score <= 75) return 'Fair — Room for Major Improvement'
  if (score <= 85) return 'Good — Optimization Opportunities Exist'
  return 'Strong — Fine Tuning Needed'
}

export function overallScore({ website, google, phone, email, social, competitive }) {
  const weights = { website: 0.25, google: 0.20, phone: 0.20, email: 0.15, social: 0.10, competitive: 0.10 }
  const values = { website, google, phone, email, social, competitive }
  let sum = 0, weightTotal = 0
  for (const key of Object.keys(weights)) {
    const v = values[key]
    if (v == null) continue
    sum += v * weights[key]
    weightTotal += weights[key]
  }
  return weightTotal > 0 ? Math.round(sum / weightTotal) : 50
}
