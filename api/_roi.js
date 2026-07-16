// Nova ROI — shared convention so every engine reports "estimated revenue influenced" the same
// honest way: a hard split between Measured (a real, already-recorded dollar amount — a paid
// invoice, a booked appointment's real service price) and Estimated (a projection with its
// assumption stated plainly), never an unlabeled number. Same discipline already proven in
// api/nova-audit/_leak.js — this just makes it a shared, reusable convention instead of an
// audit-only pattern.

export function measuredRoi(amount, source) {
  return { amount: Math.round(Number(amount) || 0), is_measured: true, source, assumption: null }
}

export function estimatedRoi(amount, assumption, confidence = 'medium') {
  return { amount: Math.round(Number(amount) || 0), is_measured: false, assumption, confidence }
}

export function formatRoi(roi) {
  if (!roi) return null
  const label = roi.is_measured ? 'Measured' : 'Estimated'
  const detail = roi.is_measured ? (roi.source ? ` (${roi.source})` : '') : ` (${roi.assumption})`
  return `${label}: $${roi.amount.toLocaleString()}${detail}`
}

export function sumRoi(rois) {
  const list = (rois || []).filter(Boolean)
  const measured = list.filter((r) => r.is_measured).reduce((s, r) => s + r.amount, 0)
  const estimated = list.filter((r) => !r.is_measured).reduce((s, r) => s + r.amount, 0)
  return { measured, estimated, total: measured + estimated }
}
