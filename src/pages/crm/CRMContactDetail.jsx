import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Phone, MessageSquare, Mail, Share2, RefreshCcw, Search, Brain } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { CRMAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const ENGINE_ICON = { voice: Phone, sms: MessageSquare, whatsapp: MessageSquare, email: Mail, social: Share2, revive: RefreshCcw, audit: Search, book: RefreshCcw, finances: RefreshCcw }

export default function CRMContactDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    CRMAPI.getContact(id).then((d) => { if (!d?.contact) setError('Contact not found.'); setData(d) }).catch((err) => setError(err.message || 'Failed to load')).finally(() => setLoading(false))
  }, [id])

  if (loading) return <DashboardShell title="Contact"><p className="text-sm" style={{ color: '#666666' }}>Loading…</p></DashboardShell>
  if (error || !data?.contact) return <DashboardShell title="Contact"><p className="text-sm" style={{ color: '#f87171' }}>{error || 'Not found.'}</p></DashboardShell>

  const { contact, activities, deals, memory, audit } = data

  return (
    <DashboardShell title="Contact Detail">
      <Link to="/dashboard/crm/contacts" className="text-xs font-bold uppercase" style={{ color: GOLD }}>&larr; All Contacts</Link>

      <div className="mt-4 grid lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-5">
          <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <h2 className="text-xl font-bold text-white">{contact.business_name || 'Unnamed'}</h2>
            <p className="text-sm mt-1" style={{ color: '#999999' }}>{contact.owner_name} · {contact.city} · {contact.industry}</p>
            <div className="flex gap-4 mt-4 flex-wrap text-xs" style={{ color: '#ccc' }}>
              {contact.phone && <span>{contact.phone}</span>}
              {contact.email && <span>{contact.email}</span>}
              {contact.website && <span>{contact.website}</span>}
            </div>
            <div className="flex gap-3 mt-4">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase" style={{ background: `${GOLD}18`, color: GOLD }}>{(contact.status || '').replace('_', ' ')}</span>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase" style={{ background: '#1A1A1A', color: '#999999' }}>Score {contact.lead_score || 0}</span>
              {contact.deal_value > 0 && <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase" style={{ background: '#1A1A1A', color: '#4ade80' }}>${Number(contact.deal_value).toLocaleString()}</span>}
            </div>
            {contact.notes && <p className="mt-4 text-sm" style={{ color: '#ccc' }}>{contact.notes}</p>}
          </div>

          {audit && (
            <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
              <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Nova Audit Data</p>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-2xl font-bold" style={{ color: GOLD }}>{audit.overall_score}</p><p className="text-[11px]" style={{ color: '#666666' }}>Overall Score</p></div>
                <div><p className="text-2xl font-bold" style={{ color: '#f87171' }}>${(audit.revenue_leak_monthly || 0).toLocaleString()}</p><p className="text-[11px]" style={{ color: '#666666' }}>Monthly Leak</p></div>
                <div><p className="text-2xl font-bold text-white">{audit.score_label}</p></div>
              </div>
            </div>
          )}

          <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Activity Timeline</p>
            {activities.length === 0 ? (
              <p className="text-sm" style={{ color: '#666666' }}>No activity logged yet.</p>
            ) : (
              <div className="space-y-0">
                {activities.map((a, i) => {
                  const Icon = ENGINE_ICON[a.engine] || Phone
                  return (
                    <div key={a.id} className="flex items-start gap-3 py-3" style={{ borderBottom: i < activities.length - 1 ? '1px solid #2A2A2A' : 'none' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: '#fff' }}>{a.summary || `${a.direction} via ${a.engine}`}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#666666' }}>{a.engine} · {a.direction} · {new Date(a.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4" style={{ color: GOLD }} />
              <p className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: GOLD }}>Nova Memory</p>
            </div>
            {!memory ? (
              <p className="text-sm" style={{ color: '#666666' }}>No memory recorded yet — builds automatically as this contact interacts with any engine.</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div><span style={{ color: '#666666' }}>Preferred language</span><p className="text-white">{memory.preferred_language}</p></div>
                <div><span style={{ color: '#666666' }}>Preferred channel</span><p className="text-white capitalize">{memory.preferred_channel}</p></div>
                <div><span style={{ color: '#666666' }}>Sentiment</span><p className="text-white capitalize">{memory.sentiment}</p></div>
                <div><span style={{ color: '#666666' }}>Response rate</span><p className="text-white">{memory.response_rate ?? 0}%</p></div>
                <div><span style={{ color: '#666666' }}>Appointments</span><p className="text-white">{memory.appointment_count || 0}</p></div>
                {memory.last_topic_discussed && <div><span style={{ color: '#666666' }}>Last topic</span><p className="text-white">{memory.last_topic_discussed}</p></div>}
                {memory.special_notes && <div><span style={{ color: '#666666' }}>Notes</span><p className="text-white">{memory.special_notes}</p></div>}
              </div>
            )}
          </div>

          <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Deals</p>
            {deals.length === 0 ? (
              <p className="text-sm" style={{ color: '#666666' }}>No deals yet.</p>
            ) : deals.map((d) => (
              <div key={d.id} className="py-2" style={{ borderBottom: '1px solid #2A2A2A' }}>
                <p className="text-sm text-white">{d.title}</p>
                <p className="text-[11px]" style={{ color: GOLD }}>${Number(d.value).toLocaleString()} · {d.stage} · {d.probability}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
