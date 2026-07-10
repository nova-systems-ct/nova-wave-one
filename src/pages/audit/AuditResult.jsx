import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, Download, Send, PlayCircle, CheckCircle2, Calendar, AlertTriangle } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { AuditAPI } from '../../lib/api'
import { scoreMeta } from '../../lib/constants'

const GOLD = '#C8A96E'

function ScoreCircle({ score, size = 140 }) {
  const meta = scoreMeta(score || 0)
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score || 0))
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2A2A" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={meta.color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color: '#fff' }}>{score ?? '—'}</span>
        <span style={{ fontSize: 10, color: '#666666' }}>/ 100</span>
      </div>
    </div>
  )
}

function ScoreCard({ label, score }) {
  const meta = scoreMeta(score || 0)
  return (
    <div className="rounded-xl p-5" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: '#666666' }}>{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold" style={{ color: meta.color }}>{score ?? '—'}</span>
        <span className="text-xs mb-1" style={{ color: '#666666' }}>/100</span>
      </div>
    </div>
  )
}

function Accordion({ title, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="rounded-xl mb-3" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-6 py-4 text-left">
        <span className="text-sm font-bold text-white">{title}</span>
        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: GOLD, transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && <div className="px-6 pb-6 text-sm" style={{ color: '#999999' }}>{children}</div>}
    </div>
  )
}

export default function AuditResult() {
  const { id } = useParams()
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  const load = () => {
    setLoading(true)
    AuditAPI.get(id).then(setAudit).catch(() => setAudit(null)).finally(() => setLoading(false))
  }
  useEffect(load, [id])

  const [resendResult, setResendResult] = useState('')

  const doAction = async (action, patch) => {
    setBusy(action)
    try {
      if (action === 'status') await AuditAPI.updateStatus({ id, ...patch })
      load()
    } catch {}
    setBusy('')
  }

  const sendReport = async () => {
    setBusy('resend')
    setResendResult('')
    try {
      const result = await AuditAPI.resend(id)
      setResendResult(result.smsOk || result.emailOk ? 'Report resent.' : 'No phone or email on file to resend to.')
      load()
    } catch (err) {
      setResendResult(err.message || 'Failed to resend.')
    }
    setBusy('')
  }

  const downloadBase64 = (base64, mime, filename) => {
    if (!base64) return
    const link = document.createElement('a')
    link.href = `data:${mime};base64,${base64}`
    link.download = filename
    link.click()
  }

  if (loading) return <DashboardShell title="Nova Audit"><p style={{ color: '#666666' }}>Loading…</p></DashboardShell>
  if (!audit) return <DashboardShell title="Nova Audit"><p style={{ color: '#666666' }}>Audit not found.</p></DashboardShell>

  const meta = scoreMeta(audit.overall_score || 0)
  const competitors = Array.isArray(audit.competitor_data) ? audit.competitor_data : []

  return (
    <DashboardShell title="Audit Result">
      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{audit.business_name}</h2>
          <p className="text-sm" style={{ color: '#999999' }}>{audit.city} · {audit.industry}</p>
          <p className="text-xs mt-1" style={{ color: '#666666' }}>{new Date(audit.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-col items-center">
          <ScoreCircle score={audit.overall_score} />
          <p className="text-xs font-bold mt-2 text-center max-w-[160px]" style={{ color: meta.color }}>{audit.score_label || meta.label}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <ScoreCard label="Website Performance" score={audit.performance_score} />
        <ScoreCard label="Google Presence" score={audit.google_score} />
        <ScoreCard label="Response Rate" score={Math.round(((audit.phone_score || 0) + (audit.email_score || 0)) / 2)} />
        <ScoreCard label="Competitive Position" score={audit.competitive_score} />
      </div>

      <div className="rounded-xl p-8 mb-8" style={{ background: '#0E0E0E', border: `1px solid ${GOLD}40` }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-2" style={{ color: '#999999' }}>Estimated Monthly Revenue Being Lost</p>
        <p className="text-5xl font-black mb-3" style={{ color: GOLD }}>${(audit.revenue_leak_monthly || 0).toLocaleString()}</p>
        <p className="text-sm mb-6" style={{ color: '#999999' }}>${(audit.revenue_leak_annual || 0).toLocaleString()} annually</p>
        {Array.isArray(audit.key_findings) && audit.key_findings.length > 0 && (
          <div className="space-y-2">
            {audit.key_findings.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                <p className="text-sm" style={{ color: '#ccc' }}>{f}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Accordion title="Website Analysis" defaultOpen>
        <p>Mobile performance score: {audit.performance_score ?? 'N/A'}/100. {audit.website ? `Scanned ${audit.website}.` : 'No website provided.'}</p>
      </Accordion>
      <Accordion title="Google Business Analysis">
        <p>Rating: {audit.google_rating ?? 'N/A'} · Reviews: {audit.google_reviews ?? 'N/A'} · Profile score: {audit.google_score ?? 'N/A'}/100</p>
      </Accordion>
      <Accordion title="Phone Test Results">
        {audit.phone_test_result?.tested ? (
          <p>We placed a real test call to {audit.phone}. Status: <span style={{ color: '#fff' }}>{audit.phone_test_result.status || 'unknown'}</span>. Phone score: {audit.phone_score}/100.</p>
        ) : (
          <p>{audit.phone ? `Test call could not be placed (${audit.phone_test_result?.reason || audit.phone_test_result?.error || 'unknown error'}). Default score of ${audit.phone_score}/100 applied.` : 'No phone number provided for testing.'}</p>
        )}
      </Accordion>
      <Accordion title="Email Test Results">
        {audit.email_test_result?.tested ? (
          <p>We sent a real test inquiry to {audit.email}. Status: <span style={{ color: '#fff' }}>{audit.email_test_result.status}</span>. Email score: {audit.email_score}/100 (reply-time scoring requires a follow-up check).</p>
        ) : (
          <p>{audit.email ? `Test email could not be sent (${audit.email_test_result?.reason || audit.email_test_result?.error || 'unknown error'}). Default score of ${audit.email_score}/100 applied.` : 'No email provided for testing.'}</p>
        )}
      </Accordion>
      <Accordion title="Social Media Analysis">
        <p>Social presence score: {audit.social_score ?? 'N/A'}/100</p>
      </Accordion>
      <Accordion title="Competitor Intelligence">
        <p>See comparison table below.</p>
      </Accordion>

      {competitors.length > 0 && (
        <div className="rounded-xl p-6 mb-8 overflow-x-auto" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Competitor Comparison</p>
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th className="text-left py-2 pr-4" style={{ color: '#666666', fontSize: 11 }}>Metric</th>
                <th className="text-left py-2 pr-4" style={{ color: '#fff', fontSize: 11 }}>{audit.business_name}</th>
                {competitors.map((c, i) => <th key={i} className="text-left py-2 pr-4" style={{ color: '#fff', fontSize: 11 }}>{c.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ['Google Rating', audit.google_rating, (c) => c.estimated_google_rating],
                ['Reviews', audit.google_reviews, (c) => c.review_count],
                ['Has Website', audit.website ? 'Yes' : 'No', (c) => (c.has_website ? 'Yes' : 'No')],
                ['Online Booking', 'No', (c) => (c.has_online_booking ? 'Yes' : 'No')],
                ['Social Score', audit.social_score, (c) => c.social_score],
                ['Est. Monthly Traffic', '—', (c) => c.estimated_monthly_traffic],
              ].map(([label, mine, getC]) => (
                <tr key={label} style={{ borderTop: '1px solid #2A2A2A' }}>
                  <td className="py-2 pr-4" style={{ color: '#666666' }}>{label}</td>
                  <td className="py-2 pr-4" style={{ color: '#fff' }}>{mine ?? '—'}</td>
                  {competitors.map((c, i) => <td key={i} className="py-2 pr-4" style={{ color: GOLD }}>{getC(c) ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resendResult && <p className="text-xs mb-4" style={{ color: GOLD }}>{resendResult}</p>}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => downloadBase64(audit.pdf_data, 'application/pdf', `${audit.business_name}-nova-audit.pdf`)} disabled={!audit.pdf_data} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: audit.pdf_data ? 1 : 0.4 }}>
          <Download className="w-3.5 h-3.5" /> Download PDF
        </button>
        <button onClick={() => downloadBase64(audit.pitch_deck_data, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', `${audit.business_name}-pitch.pptx`)} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: `1px solid ${GOLD}`, color: GOLD }}>
          <Download className="w-3.5 h-3.5" /> Download Pitch Deck
        </button>
        <button onClick={sendReport} disabled={busy} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
          <Send className="w-3.5 h-3.5" /> {busy === 'resend' ? 'Sending…' : 'Send Report to Client'}
        </button>
        <button onClick={() => doAction('status', { status: 'sequence_started' })} disabled={busy} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
          <PlayCircle className="w-3.5 h-3.5" /> Start Outreach Sequence
        </button>
        <button onClick={() => doAction('status', { status: 'contacted' })} disabled={busy} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Contacted
        </button>
        <button onClick={() => doAction('status', { meeting_booked: true })} disabled={busy} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
          <Calendar className="w-3.5 h-3.5" /> Mark as Meeting Booked
        </button>
        <button onClick={() => doAction('status', { became_client: true })} disabled={busy} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: `1px solid #4ade80`, color: '#4ade80' }}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Client
        </button>
      </div>
    </DashboardShell>
  )
}
