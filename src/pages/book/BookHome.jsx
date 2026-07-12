import { useEffect, useState } from 'react'
import { CalendarClock, ExternalLink } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { BookAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const STATUS_COLOR = { confirmed: '#4ade80', cancelled: '#f87171', completed: '#60a5fa', 'no-show': '#f59e0b' }

export default function BookHome() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const bookingUrl = typeof window !== 'undefined' ? `${window.location.origin}/book` : '/book'

  const load = () => BookAPI.getMeetings({}).then((d) => setMeetings(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const cancel = async (id) => {
    if (!confirm('Cancel this meeting?')) return
    await BookAPI.cancelMeeting({ id }).catch(() => {})
    load()
  }

  return (
    <DashboardShell title="Nova Book">
      <div className="rounded-xl p-6 mb-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: GOLD }}>Public Booking Link</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-sm px-4 py-2.5 rounded-lg" style={{ background: '#080808', color: '#ccc' }}>{bookingUrl}</code>
          <a href="/book" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase px-6 py-4" style={{ color: GOLD, borderBottom: '1px solid #2A2A2A' }}>
          <CalendarClock className="w-3.5 h-3.5 inline mr-1.5" /> Upcoming Appointments
        </p>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>Loading…</p>
        ) : meetings.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>No meetings booked yet.</p>
        ) : meetings.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <div>
              <p className="text-sm font-semibold text-white">{m.contact_name} — {m.meeting_type?.replace(/_/g, ' ')}</p>
              <p className="text-[11px]" style={{ color: '#666666' }}>{m.meeting_date} at {m.meeting_time} · {m.contact_email || m.contact_phone}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase" style={{ background: `${STATUS_COLOR[m.status] || '#999999'}18`, color: STATUS_COLOR[m.status] || '#999999' }}>{m.status}</span>
              {m.status === 'confirmed' && <button onClick={() => cancel(m.id)} className="text-[11px] uppercase font-bold" style={{ color: '#666666' }}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}
