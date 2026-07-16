import { jsPDF } from 'jspdf'

// V2 luxury palette (matches src/pages/audit/theme.js COLORS) — matte black + gold, no fake
// gradients in a PDF renderer, so panels are drawn as bordered rects instead of glass/blur.
const BLACK = [5, 7, 11]
const GOLD = [212, 175, 55]
const GOLD_LIGHT = [244, 208, 111]
const WHITE = [250, 250, 250]
const GRAY = [156, 163, 175]
const SUCCESS = [0, 200, 83]
const WARNING = [255, 179, 0]
const DANGER = [255, 82, 82]
const HAIRLINE = [40, 38, 28] // subtle gold-tinted divider on the black background

// red <=40, orange 41-60, yellow 61-75, gold 76-85, success 86-100 — matches theme.js scoreColor
function scoreColor(score) {
  if (score == null) return GRAY
  if (score <= 40) return DANGER
  if (score <= 60) return WARNING
  if (score <= 75) return GOLD_LIGHT
  if (score <= 85) return GOLD
  return SUCCESS
}

function pageFrame(doc) {
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.3)
  doc.line(20, 12, 190, 12)
  doc.line(20, 285, 190, 285)
}

function header(doc, eyebrow, title) {
  pageFrame(doc)
  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('NOVA SYSTEMS', 20, 18)
  if (eyebrow) doc.text(eyebrow.toUpperCase(), 190, 18, { align: 'right' })
  doc.setTextColor(...WHITE)
  doc.setFontSize(20)
  doc.text(title, 20, 40)
}

function panel(doc, x, y, w, h, accent = HAIRLINE) {
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 2, 2, 'S')
}

function footer(doc, pageLabel) {
  doc.setTextColor(...GRAY)
  doc.setFontSize(7)
  doc.text('CONFIDENTIAL — PREPARED BY NOVA SYSTEMS', 20, 292)
  doc.text(pageLabel, 190, 292, { align: 'right' })
}

// ============================================================ PAGE 1 — LUXURY COVER ==========

function coverPage(doc, audit) {
  pageFrame(doc)
  doc.setFillColor(...GOLD)
  doc.roundedRect(20, 24, 12, 12, 2, 2, 'F')
  doc.setTextColor(...BLACK)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('N', 26, 32.5, { align: 'center' })

  doc.setTextColor(...GOLD)
  doc.setFontSize(11)
  doc.text('NOVA SYSTEMS', 38, 32)

  doc.setTextColor(...WHITE)
  doc.setFontSize(30)
  doc.setFont('helvetica', 'bold')
  doc.text(audit.business_name || 'Business', 20, 130, { maxWidth: 170 })

  doc.setTextColor(...GOLD)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('NOVA INTELLIGENCE REPORT', 20, 142)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text(`Prepared for ${audit.owner_name || audit.business_name}`, 20, 150)
  doc.text(new Date(audit.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 20, 158)
  doc.text(`${audit.city || ''}${audit.city && audit.industry ? ' · ' : ''}${audit.industry || ''}`, 20, 166)

  const circleColor = scoreColor(audit.overall_score)
  doc.setDrawColor(...circleColor)
  doc.setLineWidth(0.8)
  doc.circle(150, 220, 24, 'S')
  doc.setTextColor(...circleColor)
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text(String(audit.overall_score ?? '—'), 150, 224, { align: 'center' })
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('OVERALL SCORE', 150, 232, { align: 'center' })
  doc.setTextColor(...circleColor)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(audit.score_label || '', 150, 250, { align: 'center', maxWidth: 60 })

  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('CONFIDENTIAL', 20, 280)
}

// ============================================================ PAGE 2 — EXECUTIVE SUMMARY ======

function quadrant(doc, x, y, label, score) {
  panel(doc, x, y, 78, 30)
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), x + 6, y + 10)
  doc.setTextColor(...scoreColor(score))
  doc.setFontSize(18)
  doc.text(String(score ?? '—'), x + 6, y + 23)
}

function execSummaryPage(doc, audit) {
  header(doc, 'Page 2 of 7', 'Executive Summary')

  quadrant(doc, 20, 50, 'Website', audit.performance_score)
  quadrant(doc, 112, 50, 'Online Presence', audit.google_score)
  quadrant(doc, 20, 84, 'Lead Capture', audit.lead_capture_score)
  quadrant(doc, 112, 84, 'Competitive Position', audit.competitive_score)

  // Compact 10-category scorecard row — the full detail lives in the in-app dashboard; this is
  // the print-ready summary version so the cover + this page carry the whole score picture.
  const categories = [
    ['Brand', audit.brand_score], ['Storefront', audit.storefront_score], ['Social', audit.social_score],
    ['Cust. Exp.', audit.customer_experience_score], ['AI Readiness', audit.ai_readiness_score],
  ]
  let cx = 20
  const cw = 34
  categories.forEach(([label, score]) => {
    panel(doc, cx, 122, cw - 4, 22)
    doc.setTextColor(...GRAY)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.text(label.toUpperCase(), cx + 4, 130)
    doc.setTextColor(...scoreColor(score))
    doc.setFontSize(14)
    doc.text(String(score ?? '—'), cx + 4, 140)
    cx += cw
  })

  let y = 158
  doc.setTextColor(...DANGER)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('TOP FINDINGS', 20, y)
  y += 8
  const findings = (audit.key_findings || []).slice(0, 3)
  findings.forEach((f) => {
    panel(doc, 20, y - 5, 170, 15, DANGER)
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(f, 160)
    doc.text(lines, 25, y + 2)
    y += 19
  })

  y += 6
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('ESTIMATED ANNUAL REVENUE BEING LOST', 20, y)
  doc.setTextColor(...GOLD)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text(`$${(audit.revenue_leak_annual || 0).toLocaleString()}`, 20, y + 14)
  footer(doc, 'Page 2 of 7')
}

// ============================================================ PAGE 3 — REVENUE LEAKS ==========

function revenueLeaksPage(doc, audit) {
  header(doc, 'Page 3 of 7', 'Revenue Leak Report')
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('ESTIMATED ANNUAL REVENUE BEING LOST', 20, 55)
  doc.setTextColor(...GOLD)
  doc.setFontSize(34)
  doc.setFont('helvetica', 'bold')
  doc.text(`$${(audit.revenue_leak_annual || 0).toLocaleString()}`, 20, 74)
  doc.setTextColor(...GRAY)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`$${(audit.revenue_leak_monthly || 0).toLocaleString()} per month, ranked by dollar impact`, 20, 82)

  const breakdown = audit.revenue_leak_breakdown || {}
  const sortedEntries = Object.entries(breakdown).sort((a, b) => Number(b[1]) - Number(a[1]))
  const maxVal = Math.max(1, ...Object.values(breakdown).map(Number))
  let y = 100
  doc.setFontSize(9)
  sortedEntries.forEach(([key, val]) => {
    const label = key.replace(/_/g, ' ')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.text(label.replace(/\b\w/g, (c) => c.toUpperCase()), 20, y)
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'normal')
    doc.text(`$${Number(val).toLocaleString()}/mo`, 130, y)
    doc.setTextColor(...GOLD)
    doc.text(`$${(Number(val) * 12).toLocaleString()}/yr`, 165, y)
    doc.setFillColor(...HAIRLINE)
    doc.rect(20, y + 3, 150, 2.5, 'F')
    doc.setFillColor(...GOLD)
    doc.rect(20, y + 3, 150 * (Number(val) / maxVal), 2.5, 'F')
    y += 15
  })

  y += 6
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.3)
  doc.line(20, y, 190, y)
  y += 10
  doc.setTextColor(...WHITE)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL ANNUAL REVENUE LEAK', 20, y)
  doc.setTextColor(...GOLD)
  doc.setFontSize(16)
  doc.text(`$${(audit.revenue_leak_annual || 0).toLocaleString()}`, 150, y)
  y += 10
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Every leak above is recoverable — see the Growth Plan for how and the timeline.', 20, y)
  footer(doc, 'Page 3 of 7')
}

// ============================================================ PAGE 4 — WEBSITE, MARKETING & COMPETITIVE INTEL

function websiteMarketingCompetitivePage(doc, audit) {
  header(doc, 'Page 4 of 7', 'Website, Marketing & Competitive Intelligence')

  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('WEBSITE', 20, 52)
  doc.setTextColor(...WHITE)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(audit.website || 'No website on file', 20, 59)
  panel(doc, 20, 64, 170, 6)
  const wPct = Math.min(100, Math.max(0, audit.performance_score || 0))
  doc.setFillColor(...scoreColor(audit.performance_score))
  if (wPct > 0) doc.roundedRect(20, 64, 170 * (wPct / 100), 6, 3, 3, 'F')
  doc.setTextColor(...GRAY)
  doc.setFontSize(7.5)
  doc.text(`Mobile performance: ${audit.performance_score ?? '—'}/100`, 20, 76)

  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('GOOGLE & REVIEWS', 20, 90)
  doc.setTextColor(...WHITE)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Rating: ${audit.google_rating ?? '—'}  ·  Reviews: ${audit.google_reviews ?? '—'}  ·  Google Score: ${audit.google_score ?? '—'}/100`, 20, 97)

  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('SOCIAL & RESPONSE', 20, 108)
  doc.setTextColor(...WHITE)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Social: ${audit.social_score ?? '—'}/100  ·  Phone Response: ${audit.phone_score ?? '—'}/100  ·  Email Response: ${audit.email_score ?? '—'}/100`, 20, 115)

  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('COMPETITOR INTELLIGENCE', 20, 130)

  const competitors = Array.isArray(audit.competitor_data) ? audit.competitor_data : []
  let y = 140
  if (!competitors.length) {
    doc.setTextColor(...GRAY)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('No competitor data available for this audit.', 20, y)
  } else {
    doc.setFontSize(7.5)
    const cols = [20, 72, 108, 144, 170]
    doc.setTextColor(...GRAY)
    ;['Metric', (audit.business_name || 'You').slice(0, 16), ...competitors.map((c) => (c.name || '').slice(0, 14))].forEach((h, i) => doc.text(h, cols[i] || 20, y))
    y += 8
    const metricRows = [
      ['Rating', audit.google_rating, (c) => c.estimated_google_rating],
      ['Reviews', audit.google_reviews, (c) => c.review_count],
      ['Has Website', audit.website ? 'Yes' : 'No', (c) => (c.has_website ? 'Yes' : 'No')],
      ['Online Booking', 'No', (c) => (c.has_online_booking ? 'Yes' : 'No')],
      ['Social Score', audit.social_score, (c) => c.social_score],
    ]
    doc.setFontSize(8.5)
    metricRows.forEach(([label, mine, getC]) => {
      doc.setTextColor(...GRAY)
      doc.setFont('helvetica', 'normal')
      doc.text(label, cols[0], y)
      doc.setTextColor(...WHITE)
      doc.text(String(mine ?? '—'), cols[1], y)
      competitors.forEach((c, i) => {
        doc.setTextColor(...GOLD)
        doc.text(String(getC(c) ?? '—'), cols[2 + i] || 170, y)
      })
      y += 8
    })

    if (competitors[0]) {
      y += 6
      panel(doc, 20, y, 170, 24, GOLD)
      doc.setTextColor(...GOLD)
      doc.setFontSize(8.5)
      const advantages = Array.isArray(competitors[0].advantages) ? competitors[0].advantages.join(', ') : String(competitors[0].advantages || 'a stronger online presence')
      doc.text(doc.splitTextToSize(`${competitors[0].name} is ahead because of: ${advantages}`, 160), 25, y + 10)
    }
  }
  footer(doc, 'Page 4 of 7')
}

// ============================================================ PAGE 5 — GROWTH PLAN ============

function growthPlanPage(doc, audit) {
  header(doc, 'Page 5 of 7', 'Growth Plan')
  const roadmap = audit.priority_roadmap || { fix_today: [], fix_this_month: [], fix_this_quarter: [] }
  const sections = [
    ['IMMEDIATE — FIX TODAY', GOLD, roadmap.fix_today],
    ['30 DAYS — WAVE ONE', GOLD, roadmap.fix_this_month],
    ['90 DAYS — WAVE TWO', GRAY, roadmap.fix_this_quarter],
  ]
  let y = 50
  sections.forEach(([title, color, items]) => {
    if (!items?.length) return
    doc.setTextColor(...color)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 20, y)
    y += 8
    items.forEach((item) => {
      doc.setTextColor(...WHITE)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      const actionLines = doc.splitTextToSize(`• ${item.action}`, 165)
      doc.text(actionLines, 20, y)
      y += actionLines.length * 5
      doc.setTextColor(...GRAY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const impactLines = doc.splitTextToSize(item.impact || '', 160)
      doc.text(impactLines, 25, y)
      y += impactLines.length * 4.5 + 5
    })
    y += 3
  })
  footer(doc, 'Page 5 of 7')
}

// ============================================================ PAGE 6 — RECOMMENDED NOVA ENGINES

function recommendedEnginesPage(doc, audit) {
  header(doc, 'Page 6 of 7', 'Recommended Nova Systems')
  const recs = Array.isArray(audit.engine_recommendations) ? audit.engine_recommendations : []
  let y = 52
  if (!recs.length) {
    doc.setTextColor(...GRAY)
    doc.setFontSize(9)
    doc.text('No specific engine gaps were flagged for this business.', 20, y)
  }
  recs.slice(0, 6).forEach((rec) => {
    const boxH = 32
    panel(doc, 20, y, 170, boxH)
    doc.setTextColor(...GOLD)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(rec.engine, 26, y + 10)
    if (rec.recovers > 0) {
      doc.setTextColor(...SUCCESS)
      doc.setFontSize(9)
      doc.text(`+$${rec.recovers.toLocaleString()}/mo`, 184, y + 10, { align: 'right' })
    }
    doc.setTextColor(...GRAY)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(rec.reason, 158), 26, y + 18)
    doc.setTextColor(...GOLD)
    doc.setFontSize(7)
    doc.text('PRICING: INCLUDED IN WAVE ONE   ·   TIMELINE: LIVE AT ONBOARDING', 26, y + 28)
    y += boxH + 6
  })
  footer(doc, 'Page 6 of 7')
}

// ============================================================ PAGE 7 — NEXT STEPS =============

function nextStepsPage(doc, audit) {
  header(doc, 'Page 7 of 7', 'Next Steps')
  doc.setTextColor(...WHITE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(doc.splitTextToSize(
    `${audit.business_name || 'This business'} has an estimated $${(audit.revenue_leak_annual || 0).toLocaleString()} in recoverable annual revenue across ${Object.values(audit.revenue_leak_breakdown || {}).filter((v) => v > 0).length} identified gaps. The Growth Plan on page 5 lays out the order of operations; the engines on page 6 are the specific fixes.`,
    170,
  ), 20, 55)

  doc.setTextColor(...GOLD)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('ROADMAP SUMMARY', 20, 90)
  const roadmap = audit.priority_roadmap || {}
  const counts = [
    ['Immediate actions', (roadmap.fix_today || []).length],
    ['30-day actions (Wave One)', (roadmap.fix_this_month || []).length],
    ['90-day actions (Wave Two)', (roadmap.fix_this_quarter || []).length],
  ]
  let y = 100
  counts.forEach(([label, count]) => {
    doc.setTextColor(...GRAY)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(label, 20, y)
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.text(String(count), 170, y, { align: 'right' })
    y += 9
  })

  doc.setFillColor(...GOLD)
  doc.roundedRect(20, 210, 170, 20, 3, 3, 'F')
  doc.setTextColor(...BLACK)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Schedule your free strategy session — nova-systems.app/welcome', 105, 222, { align: 'center' })

  doc.setDrawColor(...HAIRLINE)
  doc.setLineWidth(0.3)
  doc.line(20, 255, 100, 255)
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.text('Signature', 20, 261)
  doc.line(120, 255, 190, 255)
  doc.text('Date', 120, 261)
  footer(doc, 'Page 7 of 7')
}

export function buildAuditPdf(audit) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  coverPage(doc, audit)
  doc.addPage(); execSummaryPage(doc, audit)
  doc.addPage(); revenueLeaksPage(doc, audit)
  doc.addPage(); websiteMarketingCompetitivePage(doc, audit)
  doc.addPage(); growthPlanPage(doc, audit)
  doc.addPage(); recommendedEnginesPage(doc, audit)
  doc.addPage(); nextStepsPage(doc, audit)
  return doc.output('datauristring').split(',')[1] // base64
}
