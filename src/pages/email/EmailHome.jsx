import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Plus } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { EmailAPI } from '../../lib/api'

const GOLD = '#C8A96E'

const CATEGORY_COLOR = {
  Important: '#f87171', Client: '#4ade80', Lead: GOLD, Spam: '#666666', Automated: '#60a5fa',
}
const STATUS_LABEL = {
  auto_responded: 'Auto-Responded', drafted: 'Drafted', needs_review: 'Needs Review', ignored: 'Ignored',
}

export default function EmailHome() {
  const navigate = useNavigate()
  const [emails, setEmails] = useState([])
  const [sentEmails, setSentEmails] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      EmailAPI.list({ limit: 20 }),
      EmailAPI.list({ direction: 'outbound', sent: 'true', limit: 8 }),
    ]).then(([inbox, sent]) => {
      setEmails(Array.isArray(inbox) ? inbox : [])
      setSentEmails(Array.isArray(sent) ? sent : [])
    }).catch(() => { setEmails([]); setSentEmails([]) }).finally(() => setLoading(false))
  }, [])

  return (
    <DashboardShell title="Nova Email">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: GOLD }}>Inbox Monitor</p>
            <button onClick={() => navigate('/dashboard/email/inbox')} className="text-[11px] font-bold uppercase" style={{ color: GOLD }}>View All</button>
          </div>
          {loading ? (
            <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
          ) : emails.length === 0 ? (
            <div className="text-center py-10">
              <Mail className="w-8 h-8 mx-auto mb-3" style={{ color: '#2A2A2A' }} />
              <p className="text-sm" style={{ color: '#666666' }}>No emails received yet at hello@nova-systems.app.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {emails.slice(0, 8).map((e, i) => (
                <div key={e.id} className="py-3 flex items-center gap-3" style={{ borderBottom: i < 7 ? '1px solid #2A2A2A' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: '#fff' }}>{e.from_email}</p>
                    <p className="text-xs truncate" style={{ color: '#666666' }}>{e.subject}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: `${CATEGORY_COLOR[e.category] || GOLD}18`, color: CATEGORY_COLOR[e.category] || GOLD }}>{e.category || 'Uncategorized'}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: '#666666' }}>{STATUS_LABEL[e.status] || 'Needs Review'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: GOLD }}>Outbound Campaigns</p>
            <button onClick={() => navigate('/dashboard/email/campaigns')} className="flex items-center gap-1.5 text-[11px] font-bold uppercase" style={{ color: GOLD }}>
              <Plus className="w-3 h-3" /> New Campaign
            </button>
          </div>
          {loading ? (
            <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
          ) : sentEmails.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm" style={{ color: '#666666' }}>No campaign sends yet. Build one from the Audit pipeline.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {sentEmails.map((e, i) => (
                <div key={e.id} className="py-3 flex items-center gap-3" style={{ borderBottom: i < sentEmails.length - 1 ? '1px solid #2A2A2A' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: '#fff' }}>{e.to_email}</p>
                    <p className="text-xs truncate" style={{ color: '#666666' }}>{e.subject}</p>
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: '#666666' }}>{new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
