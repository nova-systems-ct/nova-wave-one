import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutGrid, Plus } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { CRMAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const STATUS_COLOR = {
  cold_lead: '#60a5fa', warm_lead: GOLD, hot_lead: '#f87171', proposal_sent: '#a78bfa',
  negotiating: '#f59e0b', active_client: '#4ade80', churned: '#666666',
}

export default function CRMContacts() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = (q) => {
    setLoading(true)
    CRMAPI.getContacts(q ? { search: q } : {}).then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const onSearch = (e) => {
    e.preventDefault()
    load(search)
  }

  return (
    <DashboardShell title="Nova CRM — Contacts">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <form onSubmit={onSearch} className="flex gap-2 flex-1 max-w-md">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, name, email, phone…"
            className="flex-1 px-4 py-2.5 rounded-lg text-sm" style={{ background: '#080808', border: '1px solid #2A2A2A', color: '#fff' }}
          />
          <button type="submit" className="px-4 py-2.5 rounded-lg" style={{ background: GOLD, color: '#080808' }}><Search className="w-4 h-4" /></button>
        </form>
        <button onClick={() => navigate('/dashboard/crm')} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
          <LayoutGrid className="w-3.5 h-3.5" /> Pipeline View
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <div className="grid grid-cols-[1fr_120px_100px_100px_100px_100px] gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#666666', borderBottom: '1px solid #2A2A2A' }}>
          <span>Business</span><span>Status</span><span>Score</span><span>Deal Value</span><span>City</span><span>Updated</span>
        </div>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>Loading…</p>
        ) : contacts.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>No contacts yet.</p>
        ) : contacts.map((c) => (
          <button key={c.id} onClick={() => navigate(`/dashboard/crm/contact/${c.id}`)} className="w-full grid grid-cols-[1fr_120px_100px_100px_100px_100px] gap-2 px-5 py-3 text-left text-xs" style={{ borderBottom: '1px solid #2A2A2A', color: '#ccc' }}>
            <div className="min-w-0">
              <p className="truncate font-semibold" style={{ color: '#fff' }}>{c.business_name || 'Unnamed'}</p>
              <p className="truncate text-[11px]" style={{ color: '#666666' }}>{c.owner_name}</p>
            </div>
            <span style={{ color: STATUS_COLOR[c.status] || '#999999' }}>{(c.status || '').replace('_', ' ')}</span>
            <span>{c.lead_score || 0}</span>
            <span style={{ color: GOLD }}>{c.deal_value ? `$${Number(c.deal_value).toLocaleString()}` : '—'}</span>
            <span className="truncate">{c.city || '—'}</span>
            <span style={{ color: '#666666' }}>{new Date(c.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </button>
        ))}
      </div>
    </DashboardShell>
  )
}
