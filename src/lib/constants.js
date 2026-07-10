export const CT_CITIES = [
  'Waterbury', 'Hartford', 'New Haven', 'Bridgeport', 'Stamford', 'Danbury',
  'Norwalk', 'New Britain', 'Bristol', 'Meriden', 'Milford', 'West Haven',
  'Middletown', 'Norwich', 'Shelton', 'Torrington', 'Naugatuck', 'Enfield', 'Other',
]

export const INDUSTRIES = [
  'Restaurant', 'Barbershop and Salon', 'Medical and Dental', 'Law and Finance',
  'Real Estate', 'Contractor and Trade', 'Retail Store', 'Auto Shop',
  'Gym and Fitness', 'Food Truck', 'Convenience Store', 'Nutrition Bar',
  'Jewelry Store', 'Print and Graphics Shop', 'Technology', 'Professional Services', 'Other',
]

// red <=40, orange 41-60, yellow 61-75, light green 76-85, gold 86-100
export const SCORE_LABELS = [
  { max: 41, label: 'Critical — Immediate Action Required', color: '#f87171' },
  { max: 61, label: 'Poor — Significant Gaps Detected', color: '#fb923c' },
  { max: 76, label: 'Fair — Room for Improvement', color: '#fbbf24' },
  { max: 86, label: 'Good — Optimization Available', color: '#a3e635' },
  { max: 101, label: 'Strong — Fine Tuning Needed', color: '#C8A96E' },
]

export function scoreMeta(score) {
  return SCORE_LABELS.find((s) => score < s.max) || SCORE_LABELS[SCORE_LABELS.length - 1]
}
