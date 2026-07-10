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

export function calculateRevenueLeak({ industry, phoneScore, performanceScore, googleScore }) {
  const avg = avgTransaction(industry)

  const missedCalls = missedCallsPerWeek(phoneScore)
  const monthlyCallLeak = missedCalls * 4 * avg * 0.25

  const lossPct = webLossPct(performanceScore)
  const monthlyWebLeak = 500 * lossPct * avg * 0.08

  const monthlyGoogleLeak = (googleScore != null && googleScore < 40) ? avg * 50 * 0.20 : 0

  const totalMonthly = Math.round((monthlyCallLeak + monthlyWebLeak + monthlyGoogleLeak) / 50) * 50
  const totalAnnual = totalMonthly * 12

  return {
    breakdown: {
      missed_calls: Math.round(monthlyCallLeak),
      website_abandonment: Math.round(monthlyWebLeak),
      weak_google_presence: Math.round(monthlyGoogleLeak),
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
