import { useEffect, useState } from 'react'
import { Receipt, FileDown, CalendarClock } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { TaxAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Expense Summary', 'Tax Calendar', 'Accountant Report']

function SummaryTab() {
  const [summary, setSummary] = useState(null)
  useEffect(() => { TaxAPI.getExpenseSummary({}).then(setSummary).catch(() => {}) }, [])
  if (!summary) return <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
  return (
    <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <p className="text-3xl font-bold" style={{ color: GOLD }}>${summary.total.toLocaleString()}</p>
      <p className="text-xs mt-1 mb-5" style={{ color: '#666666' }}>Total expenses ({summary.count} records)</p>
      {Object.entries(summary.by_category).map(([cat, amt]) => (
        <div key={cat} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #2A2A2A' }}>
          <span className="text-sm capitalize" style={{ color: '#ccc' }}>{cat.replace(/_/g, ' ')}</span>
          <span className="text-sm font-bold" style={{ color: GOLD }}>${amt.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function CalendarTab() {
  const [items, setItems] = useState([])
  useEffect(() => { TaxAPI.getCalendar().then((d) => setItems(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      {items.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>Loading…</p> : items.map((i) => (
        <div key={i.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
          <div className="flex items-center gap-3"><CalendarClock className="w-4 h-4" style={{ color: GOLD }} /><span className="text-sm text-white">{i.title}</span></div>
          <span className="text-xs" style={{ color: '#666666' }}>{i.due_date}</span>
        </div>
      ))}
    </div>
  )
}

function ReportTab() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState(null)
  const inputStyle = { padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

  const generate = async () => { try { setReport(await TaxAPI.generateReport({ from, to })) } catch (err) { alert(err.message) } }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} />
        <button onClick={generate} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}><FileDown className="w-3.5 h-3.5" /> Generate</button>
      </div>
      {report && (
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><p className="text-2xl font-bold" style={{ color: '#4ade80' }}>${report.total_income.toLocaleString()}</p><p className="text-[11px]" style={{ color: '#666666' }}>Income</p></div>
            <div><p className="text-2xl font-bold" style={{ color: '#f87171' }}>${report.total_expenses.toLocaleString()}</p><p className="text-[11px]" style={{ color: '#666666' }}>Expenses</p></div>
            <div><p className="text-2xl font-bold" style={{ color: GOLD }}>${report.net.toLocaleString()}</p><p className="text-[11px]" style={{ color: '#666666' }}>Net</p></div>
          </div>
          <p className="text-[11px]" style={{ color: '#666666' }}>{report.from} to {report.to} — ready to hand to an accountant. This is organization only, not tax advice.</p>
        </div>
      )}
    </div>
  )
}

export default function TaxHome() {
  const [tab, setTab] = useState('Expense Summary')
  return (
    <DashboardShell title="Nova Tax">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}><Receipt className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />Keeps expenses organized for tax season — not tax advice.</p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{ letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent' }}>{t}</button>
        ))}
      </div>
      {tab === 'Expense Summary' && <SummaryTab />}
      {tab === 'Tax Calendar' && <CalendarTab />}
      {tab === 'Accountant Report' && <ReportTab />}
    </DashboardShell>
  )
}
