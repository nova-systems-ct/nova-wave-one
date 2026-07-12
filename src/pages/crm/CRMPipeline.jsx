import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, Plus } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { CRMAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const STAGES = [
  ['cold_lead', 'Cold Lead', '#60a5fa'],
  ['warm_lead', 'Warm Lead', GOLD],
  ['hot_lead', 'Hot Lead', '#f87171'],
  ['proposal_sent', 'Proposal Sent', '#a78bfa'],
  ['negotiating', 'Negotiating', '#f59e0b'],
  ['active_client', 'Active Client', '#4ade80'],
  ['churned', 'Churned', '#666666'],
]

export default function CRMPipeline() {
  const navigate = useNavigate()
  const [pipeline, setPipeline] = useState({})
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState(null)

  const load = () => CRMAPI.getPipeline().then((d) => setPipeline(d || {})).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const moveContact = async (contactId, newStatus) => {
    await CRMAPI.updateContact({ id: contactId, status: newStatus }).catch(() => {})
    load()
  }

  return (
    <DashboardShell title="Nova CRM — Pipeline">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm max-w-xl" style={{ color: '#999999' }}>Drag a card to move it between stages. Every engine updates these contacts automatically.</p>
        <div className="flex gap-2">
          <button onClick={() => navigate('/dashboard/crm/contacts')} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
            <List className="w-3.5 h-3.5" /> List View
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(220px, 1fr))`, overflowX: 'auto' }}>
          {STAGES.map(([key, label, color]) => {
            const contacts = pipeline[key] || []
            return (
              <div
                key={key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && moveContact(dragId, key)}
                className="rounded-xl overflow-hidden flex flex-col"
                style={{ background: '#0E0E0E', border: '1px solid #2A2A2A', minHeight: 500 }}
              >
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color }}>{label}</span>
                  <span className="text-[11px] ml-auto" style={{ color: '#666666' }}>{contacts.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onClick={() => navigate(`/dashboard/crm/contact/${c.id}`)}
                      className="p-3 rounded-lg cursor-pointer transition-colors"
                      style={{ background: '#080808', border: '1px solid #2A2A2A' }}
                    >
                      <p className="text-sm font-semibold truncate" style={{ color: '#fff' }}>{c.business_name || 'Unnamed'}</p>
                      <p className="text-[11px] truncate" style={{ color: '#666666' }}>{c.city || ''}{c.city && c.industry ? ' · ' : ''}{c.industry || ''}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-bold" style={{ color: GOLD }}>{c.top_deal ? `$${Number(c.top_deal.value).toLocaleString()}` : c.deal_value ? `$${Number(c.deal_value).toLocaleString()}` : '—'}</span>
                        {c.lead_score > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${GOLD}18`, color: GOLD }}>{c.lead_score}</span>}
                      </div>
                    </div>
                  ))}
                  {contacts.length === 0 && <p className="text-[11px] p-3" style={{ color: '#444444' }}>No contacts.</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashboardShell>
  )
}
