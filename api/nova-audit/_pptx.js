import pptxgen from 'pptxgenjs'

const GOLD = 'C8A96E'
const BLACK = '080808'
const WHITE = 'FFFFFF'
const GRAY = '999999'

export async function buildPitchDeck(audit) {
  const pptx = new pptxgen()
  pptx.defineLayout({ name: 'NOVA', width: 10, height: 5.63 })
  pptx.layout = 'NOVA'

  const bgSlide = () => {
    const s = pptx.addSlide()
    s.background = { color: BLACK }
    return s
  }

  // Slide 1 — Cover
  let s = bgSlide()
  s.addText('NOVA SYSTEMS', { x: 0.5, y: 0.4, fontSize: 12, color: GOLD, bold: true, charSpacing: 3 })
  s.addText(audit.business_name || 'Business', { x: 0.5, y: 2.0, fontSize: 36, color: WHITE, bold: true, w: 9 })
  s.addText('NOVA INTELLIGENCE REPORT', { x: 0.5, y: 2.9, fontSize: 14, color: GOLD, bold: true })
  s.addText(new Date(audit.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), { x: 0.5, y: 3.3, fontSize: 11, color: GRAY })

  // Slide 2 — Score overview
  s = bgSlide()
  s.addText('Overall Score', { x: 0.5, y: 0.4, fontSize: 20, color: WHITE, bold: true })
  s.addText(String(audit.overall_score ?? '—'), { x: 0.5, y: 1.2, fontSize: 60, color: GOLD, bold: true })
  s.addText(audit.score_label || '', { x: 0.5, y: 2.4, fontSize: 12, color: GRAY })
  const quads = [
    ['Website', audit.performance_score], ['Google Presence', audit.google_score],
    ['Response Rate', Math.round(((audit.phone_score || 0) + (audit.email_score || 0)) / 2)], ['Competitive', audit.competitive_score],
  ]
  quads.forEach(([label, val], i) => {
    const x = 0.5 + (i % 2) * 4.7
    const y = 3.2 + Math.floor(i / 2) * 1.1
    s.addShape('roundRect', { x, y, w: 4.3, h: 0.9, fill: { color: '0E0E0E' }, line: { color: '2A2A2A' } })
    s.addText(label, { x: x + 0.2, y: y + 0.08, fontSize: 9, color: GRAY })
    s.addText(String(val ?? '—'), { x: x + 0.2, y: y + 0.32, fontSize: 18, color: GOLD, bold: true })
  })

  // Slide 3 — Website analysis
  s = bgSlide()
  s.addText('Website Analysis', { x: 0.5, y: 0.4, fontSize: 20, color: WHITE, bold: true })
  s.addText(audit.website || 'No website on file', { x: 0.5, y: 1.1, fontSize: 13, color: GRAY })
  s.addText(`Mobile Performance Score: ${audit.performance_score ?? '—'}/100`, { x: 0.5, y: 1.7, fontSize: 16, color: GOLD, bold: true })
  const impact = audit.performance_score != null && audit.performance_score < 70
    ? `Estimated visitor loss: ${audit.performance_score < 50 ? '53%' : '25%'} of mobile visitors before they see your phone number.`
    : 'Website speed is in good shape.'
  s.addText(impact, { x: 0.5, y: 2.4, fontSize: 12, color: WHITE, w: 9 })

  // Slide 4 — Phone & email results
  s = bgSlide()
  s.addText('Phone & Email Response', { x: 0.5, y: 0.4, fontSize: 20, color: WHITE, bold: true })
  s.addText(`Phone Test Score: ${audit.phone_score ?? '—'}/100`, { x: 0.5, y: 1.3, fontSize: 15, color: GOLD, bold: true })
  s.addText(`Email Test Score: ${audit.email_score ?? '—'}/100`, { x: 0.5, y: 2.0, fontSize: 15, color: GOLD, bold: true })
  s.addText('Slow or missed contact is a direct, fixable revenue leak.', { x: 0.5, y: 2.8, fontSize: 12, color: GRAY, w: 9 })

  // Slide 5 — Competitor comparison
  s = bgSlide()
  s.addText('Competitor Comparison', { x: 0.5, y: 0.4, fontSize: 20, color: WHITE, bold: true })
  const competitors = Array.isArray(audit.competitor_data) ? audit.competitor_data : []
  const tableRows = [
    ['Metric', audit.business_name || 'You', ...competitors.map((c) => c.name || '')],
    ['Google Rating', String(audit.google_rating ?? '—'), ...competitors.map((c) => String(c.estimated_google_rating ?? '—'))],
    ['Reviews', String(audit.google_reviews ?? '—'), ...competitors.map((c) => String(c.review_count ?? '—'))],
    ['Has Website', audit.website ? 'Yes' : 'No', ...competitors.map((c) => (c.has_website ? 'Yes' : 'No'))],
    ['Online Booking', 'No', ...competitors.map((c) => (c.has_online_booking ? 'Yes' : 'No'))],
  ].map((row) => row.map((cell) => ({ text: cell, options: { color: WHITE, fontSize: 10 } })))
  s.addTable(tableRows, { x: 0.5, y: 1.2, w: 9, border: { color: '2A2A2A', pt: 1 }, fill: { color: '0E0E0E' } })

  // Slide 6 — Revenue leak
  s = bgSlide()
  s.addText('Revenue Leak', { x: 0.5, y: 0.4, fontSize: 20, color: WHITE, bold: true })
  s.addText(`$${(audit.revenue_leak_annual || 0).toLocaleString()}`, { x: 0.5, y: 1.3, fontSize: 48, color: GOLD, bold: true })
  s.addText('estimated annual revenue being lost', { x: 0.5, y: 2.3, fontSize: 12, color: GRAY })
  s.addText(`$${(audit.revenue_leak_monthly || 0).toLocaleString()} per month — this is recoverable.`, { x: 0.5, y: 2.9, fontSize: 13, color: WHITE })

  // Slide 7 — Solution
  s = bgSlide()
  s.addText('The Nova Systems Solution', { x: 0.5, y: 0.4, fontSize: 20, color: WHITE, bold: true })
  const engines = ['Nova Voice — fixes missed calls', 'Nova Blue — fixes slow follow-up', 'Nova Email — fixes slow email response', 'Nova Social — fixes ignored DMs', 'Nova Revive — fixes dead leads', 'Nova Audit — fixes weak online presence']
  engines.forEach((line, i) => {
    s.addText(line, { x: 0.5, y: 1.2 + i * 0.55, fontSize: 13, color: i % 2 === 0 ? GOLD : WHITE })
  })

  // Slide 8 — Next steps
  s = bgSlide()
  s.addText('Next Steps', { x: 0.5, y: 1.6, fontSize: 24, color: WHITE, bold: true })
  s.addText('Book your free strategy meeting', { x: 0.5, y: 2.3, fontSize: 16, color: GOLD, bold: true })
  s.addText('nova-systems.app/welcome', { x: 0.5, y: 2.8, fontSize: 14, color: GRAY })

  return pptx.write({ outputType: 'base64' })
}
