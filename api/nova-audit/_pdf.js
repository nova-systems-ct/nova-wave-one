import { jsPDF } from 'jspdf'

const GOLD = [200, 169, 110]
const BLACK = [8, 8, 8]
const WHITE = [255, 255, 255]
const GRAY = [153, 153, 153]
const RED = [248, 113, 113]
const GREEN = [74, 222, 128]

function scoreColor(score) {
  if (score == null) return GRAY
  if (score < 40) return RED
  if (score < 70) return [251, 191, 36]
  return GREEN
}

function coverPage(doc, audit) {
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, 210, 297, 'F')

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

  doc.setTextColor(...GRAY)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('BUSINESS INTELLIGENCE AUDIT', 20, 142)
  doc.text(`Prepared for ${audit.owner_name || audit.business_name}`, 20, 150)
  doc.text(new Date(audit.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 20, 158)

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.8)
  doc.circle(150, 220, 24, 'S')
  doc.setTextColor(...GOLD)
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text(String(audit.overall_score ?? '—'), 150, 224, { align: 'center' })
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('OVERALL SCORE', 150, 232, { align: 'center' })

  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.text('CONFIDENTIAL', 20, 280)
}

function header(doc, title) {
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.3)
  doc.line(20, 24, 190, 24)
  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('NOVA SYSTEMS', 20, 18)
  doc.setTextColor(...WHITE)
  doc.setFontSize(18)
  doc.text(title, 20, 40)
}

function quadrant(doc, x, y, label, score) {
  doc.setDrawColor(60, 60, 60)
  doc.roundedRect(x, y, 78, 34, 2, 2, 'S')
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), x + 6, y + 10)
  doc.setTextColor(...scoreColor(score))
  doc.setFontSize(20)
  doc.text(String(score ?? '—'), x + 6, y + 24)
}

function execSummaryPage(doc, audit) {
  header(doc, 'Executive Summary')
  quadrant(doc, 20, 55, 'Website', audit.performance_score)
  quadrant(doc, 112, 55, 'Online Presence', audit.google_score)
  quadrant(doc, 20, 95, 'Lead Capture', Math.round(((audit.phone_score || 0) + (audit.email_score || 0)) / 2))
  quadrant(doc, 112, 95, 'Competitive Position', audit.competitive_score)

  let y = 145
  doc.setTextColor(...RED)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('TOP FINDINGS', 20, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const findings = (audit.key_findings || []).slice(0, 3)
  findings.forEach((f) => {
    doc.setDrawColor(...RED)
    doc.roundedRect(20, y - 5, 170, 14, 2, 2, 'S')
    doc.setTextColor(...WHITE)
    const lines = doc.splitTextToSize(f, 160)
    doc.text(lines, 25, y + 2)
    y += 18
  })

  y += 10
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.text('ESTIMATED MONTHLY REVENUE BEING LOST', 20, y)
  doc.setTextColor(...GOLD)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text(`$${(audit.revenue_leak_monthly || 0).toLocaleString()}`, 20, y + 14)
}

function websitePage(doc, audit) {
  header(doc, 'Website & Digital Analysis')
  doc.setTextColor(...WHITE)
  doc.setFontSize(10)
  doc.text(audit.website || 'No website on file', 20, 55)

  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.text('MOBILE PERFORMANCE SCORE', 20, 70)
  doc.setDrawColor(60, 60, 60)
  doc.roundedRect(20, 74, 170, 6, 3, 3, 'S')
  const pct = Math.min(100, Math.max(0, audit.performance_score || 0))
  doc.setFillColor(...scoreColor(audit.performance_score))
  if (pct > 0) doc.roundedRect(20, 74, 170 * (pct / 100), 6, 3, 3, 'F')

  const rows = [
    ['Online Booking', 'No'], ['Live Chat', 'No'], ['Contact Form', audit.website ? 'Likely' : 'No'],
    ['SSL Certificate', audit.website?.startsWith('https') ? 'Yes' : 'Unknown'], ['Mobile Responsive', audit.performance_score >= 50 ? 'Likely' : 'Unlikely'],
  ]
  let y = 95
  doc.setFontSize(9)
  rows.forEach(([label, val]) => {
    doc.setTextColor(...GRAY)
    doc.text(label, 20, y)
    doc.setTextColor(...WHITE)
    doc.text(val, 120, y)
    y += 9
  })

  doc.setDrawColor(...GOLD)
  doc.roundedRect(20, y + 5, 170, 26, 2, 2, 'S')
  doc.setTextColor(...GOLD)
  const impact = audit.performance_score != null && audit.performance_score < 70
    ? `At your current mobile speed you are losing an estimated ${audit.performance_score < 50 ? '53%' : '25%'} of mobile visitors before they see your phone number.`
    : 'Your website speed is in good shape — focus on conversion features next.'
  doc.text(doc.splitTextToSize(impact, 160), 25, y + 15)
}

function responsePage(doc, audit) {
  header(doc, 'Phone & Email Response Report')
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.text('PHONE TEST', 20, 55)
  doc.setTextColor(...WHITE)
  doc.setFontSize(10)
  const phoneResult = audit.phone_test_result
  doc.text(phoneResult ? `Result: ${JSON.stringify(phoneResult).slice(0, 90)}` : 'No phone number provided.', 20, 63, { maxWidth: 170 })
  doc.setTextColor(...scoreColor(audit.phone_score))
  doc.setFontSize(16)
  doc.text(`Score: ${audit.phone_score ?? '—'}/100`, 20, 78)

  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.text('EMAIL TEST', 20, 100)
  doc.setTextColor(...WHITE)
  doc.setFontSize(10)
  const emailResult = audit.email_test_result
  doc.text(emailResult ? `Result: ${JSON.stringify(emailResult).slice(0, 90)}` : 'No email address provided.', 20, 108, { maxWidth: 170 })
  doc.setTextColor(...scoreColor(audit.email_score))
  doc.setFontSize(16)
  doc.text(`Score: ${audit.email_score ?? '—'}/100`, 20, 123)

  doc.setDrawColor(...GOLD)
  doc.roundedRect(20, 145, 170, 26, 2, 2, 'S')
  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.text('Slow or missed contact is a direct, fixable revenue leak — see page 6 for the dollar impact.', 25, 158, { maxWidth: 160 })
}

function competitorPage(doc, audit) {
  header(doc, 'Competitor Intelligence')
  const competitors = Array.isArray(audit.competitor_data) ? audit.competitor_data : []
  let y = 55
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  const cols = [20, 75, 110, 140, 170]
  ;['Metric', audit.business_name?.slice(0, 14) || 'You', ...competitors.map((c) => (c.name || '').slice(0, 14))].forEach((h, i) => doc.text(h, cols[i] || 20, y))
  y += 8
  const metricRows = [
    ['Rating', audit.google_rating, (c) => c.estimated_google_rating],
    ['Reviews', audit.google_reviews, (c) => c.review_count],
    ['Website', audit.website ? 'Yes' : 'No', (c) => (c.has_website ? 'Yes' : 'No')],
    ['Booking', 'No', (c) => (c.has_online_booking ? 'Yes' : 'No')],
    ['Social', audit.social_score, (c) => c.social_media_score],
  ]
  doc.setFontSize(9)
  metricRows.forEach(([label, mine, getC]) => {
    doc.setTextColor(...GRAY)
    doc.text(label, cols[0], y)
    doc.setTextColor(...WHITE)
    doc.text(String(mine ?? '—'), cols[1], y)
    competitors.forEach((c, i) => {
      doc.setTextColor(...GOLD)
      doc.text(String(getC(c) ?? '—'), cols[2 + i] || 170, y)
    })
    y += 10
  })

  if (competitors[0]) {
    y += 10
    doc.setDrawColor(...GOLD)
    doc.roundedRect(20, y, 170, 30, 2, 2, 'S')
    doc.setTextColor(...GOLD)
    doc.setFontSize(9)
    const advantages = Array.isArray(competitors[0].advantages_over_client) ? competitors[0].advantages_over_client.join(', ') : String(competitors[0].advantages_over_client || 'stronger online presence')
    doc.text(doc.splitTextToSize(`${competitors[0].name} is ahead because of: ${advantages}`, 160), 25, y + 12)
  }
}

function revenuePage(doc, audit) {
  header(doc, 'Revenue Leak Breakdown')
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.text('ESTIMATED MONTHLY REVENUE BEING LOST', 20, 55)
  doc.setTextColor(...GOLD)
  doc.setFontSize(36)
  doc.setFont('helvetica', 'bold')
  doc.text(`$${(audit.revenue_leak_monthly || 0).toLocaleString()}`, 20, 75)

  const breakdown = audit.revenue_leak_breakdown || {}
  let y = 95
  doc.setFontSize(9)
  Object.entries(breakdown).forEach(([key, val]) => {
    const label = key.replace(/_/g, ' ')
    doc.setTextColor(...GRAY)
    doc.text(label, 20, y)
    doc.setTextColor(...WHITE)
    doc.text(`$${Number(val).toLocaleString()}`, 150, y)
    const maxVal = Math.max(1, ...Object.values(breakdown).map(Number))
    doc.setFillColor(...GOLD)
    doc.rect(20, y + 3, 120 * (Number(val) / maxVal), 4, 'F')
    y += 14
  })

  y += 10
  doc.setTextColor(...WHITE)
  doc.setFontSize(11)
  doc.text(`You are leaving $${(audit.revenue_leak_annual || 0).toLocaleString()} on the table every year.`, 20, y, { maxWidth: 170 })
  doc.setTextColor(...GOLD)
  doc.text('This is recoverable.', 20, y + 10)
}

function solutionPage(doc, audit) {
  header(doc, 'The Solution & Next Steps')
  const items = [
    ['Nova Voice', `Fixes missed calls — your phone test scored ${audit.phone_score ?? '—'}/100.`],
    ['Nova Blue (SMS)', 'Follows up with every lead within minutes, automatically.'],
    ['Nova Email', `Fixes slow email response — your email test scored ${audit.email_score ?? '—'}/100.`],
    ['Nova Social', 'Handles every DM and comment so no inquiry goes unanswered.'],
    ['Nova Revive', 'Reactivates the dead leads already sitting in your database.'],
    ['Nova Audit + Website', `Fixes the website findings on page 3 — current score ${audit.performance_score ?? '—'}/100.`],
  ]
  let y = 55
  items.forEach(([name, desc]) => {
    doc.setTextColor(...GOLD)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(name, 20, y)
    doc.setTextColor(...GRAY)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(desc, 165), 20, y + 7)
    y += 24
  })

  doc.setFillColor(...GOLD)
  doc.roundedRect(20, 255, 170, 18, 3, 3, 'F')
  doc.setTextColor(...BLACK)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Book your free strategy meeting — nova-systems.app/welcome', 105, 266, { align: 'center' })
}

export function buildAuditPdf(audit) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  coverPage(doc, audit)
  doc.addPage(); execSummaryPage(doc, audit)
  doc.addPage(); websitePage(doc, audit)
  doc.addPage(); responsePage(doc, audit)
  doc.addPage(); competitorPage(doc, audit)
  doc.addPage(); revenuePage(doc, audit)
  doc.addPage(); solutionPage(doc, audit)
  return doc.output('datauristring').split(',')[1] // base64
}
