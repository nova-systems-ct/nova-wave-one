export const CT_CITIES = [
  'Waterbury', 'Hartford', 'New Haven', 'Bridgeport', 'Stamford', 'Danbury',
  'Norwalk', 'New Britain', 'Bristol', 'Meriden', 'Milford', 'West Haven',
  'Middletown', 'Norwich', 'Shelton', 'Torrington', 'Naugatuck', 'Enfield', 'Other',
]

export const INDUSTRIES = [
  'Restaurant', 'Barbershop and Salon', 'Medical and Dental', 'Law and Finance',
  'Real Estate', 'Contractor and Trade', 'Retail Store', 'Auto Shop',
  'Gym and Fitness', 'Food Truck', 'Convenience Store', 'Nutrition Bar',
  'Jewelry Store', 'Print and Graphics Shop', 'Other',
]

export const SCORE_LABELS = [
  { max: 40, label: 'Critical — Immediate Action Required', color: '#f87171' },
  { max: 60, label: 'Poor — Significant Gaps Detected', color: '#fb923c' },
  { max: 75, label: 'Fair — Room for Major Improvement', color: '#fbbf24' },
  { max: 85, label: 'Good — Optimization Opportunities Exist', color: '#a3e635' },
  { max: 101, label: 'Strong — Fine Tuning Needed', color: '#4ade80' },
]

export function scoreMeta(score) {
  return SCORE_LABELS.find((s) => score < s.max) || SCORE_LABELS[SCORE_LABELS.length - 1]
}
