import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { AuditAPI } from '../../lib/api'
import { scoreMeta, INDUSTRIES } from '../../lib/constants'
import { COLORS, glassPanel, scoreColor, inputStyle } from './theme'
import './audit-theme.css'

function toCsvValue(v) {
  const s = Array.isArray(v) ? v.join('; ') : String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function exportCsv(audits) {
  const headers = ['Business', 'City', 'Industry', 'Score', 'Monthly Leak', 'Status', 'Date']
  const rows = audits.map((a) => [a.business_name, a.city, a.industry, a.overall_score, a.revenue_leak_monthly, a.outreach_status, a.created_at])
  const csv = [headers.map(toCsvValue).join(','), ...rows.map((r) => r.map(toCsvValue).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nova-audit-reports-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function AuditStatCard({ icon: Icon, label, value }) {
  return (
    <div className="p-6 n-fade-up n-card-hover" style={glassPanel}>
      <div className="flex items-center justify-between mb-4">
        {Icon && <Icon className="w-4 h-4" style={{ color: COLORS.gold }} />}
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color: COLORS.gold, letterSpacing: '-0.02em' }}>{value}</p>
      <p className="text-xs" style={{ color: COLORS.gray }}>{label}</p>
    </div>
  )
}

export default function AuditReports() {
  const navigate = useNavigate()
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')

  useEffect(() => {
    AuditAPI.list().then((data) => setAudits(Array.isArray(data) ? data : [])).catch(() => setAudits([])).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      if (industryFilter && a.industry !== industryFilter) return false
      if (search && !a.business_name?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [audits, search, industryFilter])

  const avgScore = audits.length ? Math.round(audits.reduce((s, a) => s + (a.overall_score || 0), 0) / audits.length) : 0
  const totalLeak = audits.reduce((s, a) => s + (a.revenue_leak_monthly || 0), 0)
  const meetingsBooked = audits.filter((a) => a.meeting_booked).length

  return (
    <DashboardShell title="Audit Reports">
      <div className="nova-audit-v2 -m-8 p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <AuditStatCard icon={Search} label="Total Audits" value={audits.length} />
          <AuditStatCard label="Average Score" value={avgScore} />
          <AuditStatCard label="Total Leaks Found" value={`$${totalLeak.toLocaleString()}`} />
          <AuditStatCard label="Meetings Booked" value={meetingsBooked} />
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business name…"
            style={{ ...inputStyle, minWidth: 220, width: 'auto' }}
          />
          <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
            <option value="">All Industries</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <button onClick={() => exportCsv(filtered)} className="ml-auto flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ border: `1px solid ${COLORS.gold}50`, color: COLORS.gold }}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        <div className="overflow-hidden n-fade-up" style={glassPanel}>
          {loading ? (
            <p className="p-8 text-sm" style={{ color: COLORS.gray }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-sm" style={{ color: COLORS.gray }}>No audits found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                  {['Business', 'City', 'Industry', 'Score', 'Monthly Leak', 'Status', 'Date'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: COLORS.gray }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const color = scoreColor(a.overall_score)
                  return (
                    <tr key={a.id} onClick={() => navigate(`/dashboard/audit/result/${a.id}`)} style={{ borderBottom: `1px solid ${COLORS.cardBorder}`, cursor: 'pointer' }}>
                      <td className="px-5 py-3" style={{ color: COLORS.white }}>{a.business_name}</td>
                      <td className="px-5 py-3" style={{ color: COLORS.gray }}>{a.city}</td>
                      <td className="px-5 py-3" style={{ color: COLORS.gray }}>{a.industry}</td>
                      <td className="px-5 py-3"><span style={{ color, fontWeight: 700 }}>{a.overall_score ?? '—'}</span></td>
                      <td className="px-5 py-3" style={{ color: COLORS.gold }}>${(a.revenue_leak_monthly || 0).toLocaleString()}</td>
                      <td className="px-5 py-3" style={{ color: COLORS.gray, textTransform: 'capitalize' }}>{(a.outreach_status || 'pending').replace('_', ' ')}</td>
                      <td className="px-5 py-3" style={{ color: COLORS.gray }}>{new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
