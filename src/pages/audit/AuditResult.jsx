import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Download, Send, Calendar, CheckCircle2, AlertTriangle, Zap, ArrowRight,
  Award, Store, Globe, MapPin, Share2, PhoneCall, Smile, Bot, TrendingDown, HeartPulse,
} from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { AuditAPI } from '../../lib/api'
import { scoreMeta } from '../../lib/constants'
import { getMockAudit, isMockAuditId } from '../../lib/mockAudit'

const GOLD = '#C8A96E'
const HOURLY_VALUE = 50 // $/hour, per spec, used to price out AI-automatable hours

function ScoreCircle({ score, size = 130 }) {
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

function highlightDollars(text) {
  const parts = text.split(/(\$[\d,]+)/g)
  return parts.map((part, i) => /^\$[\d,]+$/.test(part) ? <span key={i} style={{ color: GOLD, fontWeight: 700 }}>{part}</span> : part)
}

function diagnose(key, score) {
  const s = score ?? 0
  const good = s >= 70
  const map = {
    brand: good ? 'Strong, consistent brand presence' : 'Inconsistent branding is costing you trust',
    storefront: good ? 'Strong physical presence signals' : 'Your storefront presence needs work',
    website: good ? 'Fast, converting website' : score == null ? 'No performance data available' : 'Your website is costing you visitors',
    google: good ? 'Strong local search visibility' : 'You are losing local searches to competitors',
    social: good ? 'Active, consistent presence' : 'Thin social presence — leads are going cold',
    leadCapture: good ? 'Capturing most inbound contacts' : 'Contacts are slipping through the cracks',
    customerExperience: good ? 'Strong post-contact experience' : 'No booking, loyalty, or follow-up system visible',
    aiReadiness: s >= 70 ? 'High potential for AI automation' : 'Limited immediate AI opportunity',
    revenueLeak: good ? 'Leak levels are well controlled' : 'Significant recoverable revenue at stake',
  }
  return map[key] || ''
}

export default function AuditResult() {
  const { id } = useParams()
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [resendResult, setResendResult] = useState('')

  const load = () => {
    setLoading(true)
    // Local-dev mock results never hit the real API — they live in sessionStorage instead.
    if (isMockAuditId(id)) {
      try {
        setAudit(getMockAudit(id))
      } catch (err) {
        console.error('[AuditResult] Failed to read mock audit:', err)
        setAudit(null)
      }
      setLoading(false)
      return
    }
    AuditAPI.get(id)
      .then((data) => setAudit(data || null))
      .catch((err) => { console.error('[AuditResult] Failed to load audit:', err); setAudit(null) })
      .finally(() => setLoading(false))
  }
  useEffect(load, [id])

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

  const [downloadNotice, setDownloadNotice] = useState('')

  const downloadBase64 = (base64, mime, filename) => {
    if (!base64) {
      setDownloadNotice('PDF generation requires the full audit to be run on the deployed version.')
      return
    }
    setDownloadNotice('')
    const link = document.createElement('a')
    link.href = `data:${mime};base64,${base64}`
    link.download = filename
    link.click()
  }

  if (loading) return <DashboardShell title="Nova Audit"><p style={{ color: '#666666' }}>Loading…</p></DashboardShell>
  if (!audit) return <DashboardShell title="Nova Audit"><p style={{ color: '#666666' }}>Audit not found.</p></DashboardShell>

  const meta = scoreMeta(audit?.overall_score || 0)
  const competitors = Array.isArray(audit?.competitor_data) ? audit.competitor_data : []
  const roadmap = audit?.priority_roadmap || {}
  const roadmapToday = Array.isArray(roadmap?.fix_today) ? roadmap.fix_today : []
  const roadmapMonth = Array.isArray(roadmap?.fix_this_month) ? roadmap.fix_this_month : []
  const roadmapQuarter = Array.isArray(roadmap?.fix_this_quarter) ? roadmap.fix_this_quarter : []
  const breakdown = audit?.revenue_leak_breakdown || {}
  const sortedLeaks = Object.entries(breakdown).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
  const revenueSeverity = Math.max(0, 100 - Math.min(100, Math.round((audit?.revenue_leak_monthly || 0) / 100)))
  const createdAtDate = audit?.created_at ? new Date(audit.created_at) : null
  const createdAtLabel = createdAtDate && !isNaN(createdAtDate) ? createdAtDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'

  const categories = [
    { key: 'brand', label: 'Brand', score: audit.brand_score, icon: Award },
    { key: 'storefront', label: 'Storefront', score: audit.storefront_score, icon: Store },
    { key: 'website', label: 'Website', score: audit.performance_score, icon: Globe },
    { key: 'google', label: 'Google', score: audit.google_score, icon: MapPin },
    { key: 'social', label: 'Social Media', score: audit.social_score, icon: Share2 },
    { key: 'leadCapture', label: 'Lead Capture', score: audit.lead_capture_score, icon: PhoneCall },
    { key: 'customerExperience', label: 'Customer Experience', score: audit.customer_experience_score, icon: Smile },
    { key: 'aiReadiness', label: 'AI Readiness', score: audit.ai_readiness_score, icon: Bot },
    { key: 'revenueLeak', label: 'Revenue Leak', score: revenueSeverity, icon: TrendingDown },
    { key: 'overall', label: 'Overall Health', score: audit.overall_score, icon: HeartPulse },
  ]

  // AI Readiness detail — reconstructed from the same thresholds the backend used to score it.
  const aiTasks = []
  if (audit.phone_score == null || audit.phone_score < 60) aiTasks.push({ task: 'Phone answering & appointment booking', hours: 5 })
  if (audit.email_score == null || audit.email_score < 70) aiTasks.push({ task: 'Inbox triage & responses', hours: 4 })
  if (audit.social_score == null || audit.social_score < 60) aiTasks.push({ task: 'Social DM & comment replies', hours: 3 })
  if (audit.customer_experience_score == null || audit.customer_experience_score < 50) aiTasks.push({ task: 'Follow-up & loyalty outreach', hours: 3 })
  const totalHoursPerWeek = aiTasks.reduce((s, t) => s + t.hours, 0)
  const annualValue = totalHoursPerWeek * 52 * HOURLY_VALUE

  const wavesFormUrl = `https://nova-systems.app/waves/form?business_name=${encodeURIComponent(audit?.business_name || '')}&phone=${encodeURIComponent(audit?.phone || '')}&email=${encodeURIComponent(audit?.email || '')}&city=${encodeURIComponent(audit?.city || '')}&industry=${encodeURIComponent(audit?.industry || '')}`

  return (
    <DashboardShell title="Nova Intelligence Report">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-6 mb-10">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2" style={{ color: GOLD }}>Nova Intelligence Report</p>
          <h1 className="text-4xl font-black text-white mb-2">{audit?.business_name || 'Untitled Business'}</h1>
          <p className="text-sm" style={{ color: '#999999' }}>{audit?.city || '—'} · {audit?.industry || '—'}</p>
          <p className="text-xs mt-1" style={{ color: '#666666' }}>{createdAtLabel}</p>
        </div>
        <div className="flex flex-col items-center">
          <ScoreCircle score={audit?.overall_score} />
          <p className="text-xs font-bold mt-2 text-center max-w-[180px]" style={{ color: meta.color }}>{audit?.score_label || meta.label}</p>
        </div>
      </div>

      {/* REVENUE LEAK — shown first */}
      <div className="rounded-xl p-8 mb-10" style={{ background: '#0E0E0E', border: `1px solid ${GOLD}50` }}>
        <p className="text-sm font-bold tracking-[0.05em] uppercase mb-2" style={{ color: '#999999' }}>Estimated Annual Revenue Being Lost</p>
        <p className="text-6xl font-black mb-1" style={{ color: GOLD }}>${(audit.revenue_leak_annual || 0).toLocaleString()}</p>
        <p className="text-sm mb-8" style={{ color: '#666666' }}>${(audit.revenue_leak_monthly || 0).toLocaleString()} per month</p>

        {sortedLeaks.length > 0 && (
          <div className="mb-6">
            {sortedLeaks.map(([key, val]) => (
              <div key={key} className="flex items-center gap-4 py-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#f87171' }} />
                <span className="text-sm flex-1 capitalize" style={{ color: '#fff' }}>{key.replace(/_/g, ' ')}</span>
                <span className="text-sm" style={{ color: '#999999' }}>${Number(val).toLocaleString()}/mo</span>
                <span className="text-sm font-bold" style={{ color: GOLD }}>${(Number(val) * 12).toLocaleString()}/yr</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4" style={{ borderTop: `1px solid ${GOLD}40` }}>
          <span className="text-sm font-bold uppercase tracking-[0.05em]" style={{ color: '#fff' }}>Total Annual Revenue Leak</span>
          <span className="text-2xl font-black" style={{ color: GOLD }}>${(audit.revenue_leak_annual || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* 10 CATEGORY SCORES */}
      <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Ten-Category Intelligence Score</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        {categories.map(({ key, label, score, icon: Icon }) => {
          const cm = scoreMeta(score || 0)
          return (
            <div key={key} className="rounded-xl p-4" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
              <Icon className="w-4 h-4 mb-3" style={{ color: GOLD }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] mb-1" style={{ color: '#666666' }}>{label}</p>
              <p className="text-2xl font-black mb-2" style={{ color: cm.color }}>{score ?? '—'}</p>
              <div style={{ height: 4, background: '#2A2A2A', borderRadius: 2, marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, score || 0))}%`, background: cm.color, borderRadius: 2 }} />
              </div>
              <p className="text-[10px] leading-snug" style={{ color: '#666666' }}>{diagnose(key, score)}</p>
            </div>
          )
        })}
      </div>

      {/* COMPETITOR INTELLIGENCE */}
      <div className="rounded-xl p-6 mb-10 overflow-x-auto" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Competitor Intelligence</p>
        {competitors.length === 0 ? (
          <p className="text-sm" style={{ color: '#666666' }}>No competitor data available for this audit yet.</p>
        ) : (
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th className="text-left py-2 pr-4" style={{ color: '#666666', fontSize: 11 }}>Metric</th>
                <th className="text-left py-2 pr-4" style={{ color: '#fff', fontSize: 11 }}>Your Business</th>
                {competitors.map((c, i) => <th key={i} className="text-left py-2 pr-4" style={{ color: '#fff', fontSize: 11 }}>{c.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ['Google Rating', audit.google_rating, (c) => c.estimated_google_rating, (mine, comp) => comp > (mine || 0)],
                ['Reviews', audit.google_reviews, (c) => c.review_count, (mine, comp) => comp > (mine || 0)],
                ['Website Speed', audit.performance_score, () => null, () => false],
                ['Online Booking', audit.website ? 'No' : 'No', (c) => (c.has_online_booking ? 'Yes' : 'No'), (mine, comp) => comp === 'Yes'],
                ['Social Score', audit.social_score, (c) => c.social_score, (mine, comp) => comp > (mine || 0)],
                ['Est. Monthly Traffic', '—', (c) => c.estimated_monthly_traffic, () => false],
              ].map(([label, mine, getC, isAhead]) => (
                <tr key={label} style={{ borderTop: '1px solid #2A2A2A' }}>
                  <td className="py-2 pr-4" style={{ color: '#666666' }}>{label}</td>
                  <td className="py-2 pr-4" style={{ color: '#fff' }}>{mine ?? '—'}</td>
                  {competitors.map((c, i) => {
                    const val = getC(c)
                    const ahead = isAhead(mine, val)
                    return <td key={i} className="py-2 pr-4 rounded" style={{ color: ahead ? GOLD : '#f87171', fontWeight: 600 }}>{val ?? '—'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* KEY FINDINGS */}
      <div className="mb-10">
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Key Findings</p>
        <div className="space-y-2">
          {(Array.isArray(audit?.key_findings) && audit.key_findings.length > 0
            ? audit.key_findings
            : ['No specific issues were flagged — this business is in reasonably good shape across the categories we could measure.']
          ).map((f, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
              <p className="text-sm font-semibold leading-relaxed" style={{ color: '#eee' }}>{highlightDollars(f || '')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PRIORITY ROADMAP */}
      <div className="mb-10">
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Priority Roadmap</p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'Fix Today', color: '#4ade80', items: roadmapToday, key: 'today' },
            { title: 'Fix This Month — Wave One', color: GOLD, items: roadmapMonth, key: 'month' },
            { title: 'Fix This Quarter — Wave Two', color: '#999999', items: roadmapQuarter, key: 'quarter' },
          ].map(({ title, color, items, key }) => (
            <div key={key} className="rounded-xl p-5" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
              <p className="text-xs font-bold uppercase tracking-[0.08em] mb-4" style={{ color }}>{title}</p>
              {(!items || items.length === 0) ? (
                <p className="text-xs" style={{ color: '#666666' }}>Nothing urgent here.</p>
              ) : (
                <div className="space-y-4">
                  {items.map((item, i) => (
                    <div key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid #2A2A2A' : 'none', paddingBottom: 14 }}>
                      <p className="text-sm font-bold text-white mb-1">{item?.action || 'Action'}</p>
                      <p className="text-xs mb-2" style={{ color: '#999999' }}>{item?.impact || ''}</p>
                      <p className="text-[11px] mb-2" style={{ color: '#666666' }}>{item?.cost || item?.estimated_cost || ''}{item?.time ? ` · ${item.time}` : ''}</p>
                      {key === 'month' && (
                        <button className="text-[10px] font-bold uppercase tracking-[0.05em] px-3 py-1.5 rounded" style={{ border: `1px solid ${GOLD}50`, color: GOLD }}>
                          Include in Wave One Proposal
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI READINESS */}
      <div className="rounded-xl p-6 mb-10" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4" style={{ color: GOLD }} />
          <p className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: GOLD }}>AI Readiness</p>
        </div>
        {aiTasks.length === 0 ? (
          <p className="text-sm" style={{ color: '#999999' }}>Most of your customer-facing tasks are already well-covered — limited immediate AI opportunity.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-3xl font-black" style={{ color: GOLD }}>{totalHoursPerWeek} hrs</p>
                <p className="text-xs" style={{ color: '#666666' }}>could be saved per week</p>
              </div>
              <div>
                <p className="text-3xl font-black" style={{ color: GOLD }}>${annualValue.toLocaleString()}</p>
                <p className="text-xs" style={{ color: '#666666' }}>estimated annual value at ${HOURLY_VALUE}/hour</p>
              </div>
            </div>
            <div className="space-y-2">
              {aiTasks.map((t) => (
                <div key={t.task} className="flex items-center justify-between text-sm py-2" style={{ borderTop: '1px solid #2A2A2A' }}>
                  <span style={{ color: '#eee' }}>{t.task}</span>
                  <span style={{ color: '#999999' }}>~{t.hours} hrs/week</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {resendResult && <p className="text-xs mb-4" style={{ color: GOLD }}>{resendResult}</p>}
      {downloadNotice && <p className="text-xs mb-4" style={{ color: '#fbbf24' }}>{downloadNotice}</p>}

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => downloadBase64(audit?.pdf_data, 'application/pdf', `${audit?.business_name || 'business'}-nova-intelligence-report.pdf`)} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>
          <Download className="w-3.5 h-3.5" /> Download Nova Intelligence Report
        </button>
        <button onClick={() => downloadBase64(audit?.pitch_deck_data, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', `${audit?.business_name || 'business'}-pitch.pptx`)} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: `1px solid ${GOLD}`, color: GOLD }}>
          <Download className="w-3.5 h-3.5" /> Download Pitch Deck
        </button>
        <a href="https://nova-systems.app/welcome" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ background: '#000', color: '#fff', border: '1px solid #2A2A2A' }}>
          <Calendar className="w-3.5 h-3.5" /> Book a Free Strategy Meeting
        </a>
        <button onClick={sendReport} disabled={busy} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
          <Send className="w-3.5 h-3.5" /> {busy === 'resend' ? 'Sending…' : 'Send Report to Client'}
        </button>
        <a href={wavesFormUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: `1px solid ${GOLD}`, color: GOLD }}>
          <Zap className="w-3.5 h-3.5" /> Start Wave One <ArrowRight className="w-3 h-3" />
        </a>
        <button onClick={() => doAction('status', { meeting_booked: true })} disabled={busy} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
          <Calendar className="w-3.5 h-3.5" /> Mark as Meeting Booked
        </button>
        <button onClick={() => doAction('status', { became_client: true })} disabled={busy} className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: '1px solid #4ade80', color: '#4ade80' }}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Client
        </button>
      </div>
    </DashboardShell>
  )
}
