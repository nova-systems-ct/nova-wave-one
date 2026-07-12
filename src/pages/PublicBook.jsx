import { useEffect, useState } from 'react'
import { CalendarClock, Check } from 'lucide-react'
import NovaLogo from '../components/NovaLogo'
import { BookAPI } from '../lib/api'

const GOLD = '#C8A96E'
const MEETING_TYPES = [
  { id: 'strategy_call', label: 'Free Strategy Call', minutes: 30 },
  { id: 'wave_one_demo', label: 'Wave One Demo', minutes: 45 },
  { id: 'client_onboarding', label: 'Client Onboarding', minutes: 60 },
  { id: 'quick_checkin', label: 'Quick Check-in', minutes: 15 },
]

const inputStyle = { width: '100%', padding: '12px 14px', background: '#0E0E0E', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' }

function nextBusinessDays(n) {
  const days = []
  const d = new Date()
  while (days.length < n) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d))
  }
  return days
}

export default function PublicBook() {
  const [meetingType, setMeetingType] = useState('strategy_call')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState('')
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const days = nextBusinessDays(10)

  useEffect(() => {
    if (!date) { setSlots([]); return }
    BookAPI.getAvailability({ date }).then((d) => setSlots(d.available_slots || [])).catch(() => setSlots([]))
  }, [date])

  const submit = async (e) => {
    e.preventDefault()
    if (!date || !time || !name || (!email && !phone)) { setError('Please fill in your name, a date, a time, and either an email or phone number.'); return }
    setBooking(true); setError('')
    try {
      await BookAPI.createMeeting({ contact_name: name, contact_email: email, contact_phone: phone, business_name: business, meeting_type: meetingType, meeting_date: date, meeting_time: time })
      setDone(true)
    } catch (err) {
      setError(err.message || 'Booking failed — please try a different time.')
    }
    setBooking(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#080808' }}>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}` }}>
            <Check className="w-6 h-6" style={{ color: GOLD }} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">You're booked.</h1>
          <p className="text-sm" style={{ color: '#999999' }}>A confirmation has been sent to you. We'll see you {date} at {time}.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: '#080808' }}>
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <NovaLogo size={36} />
          <p className="mt-3 text-xs font-bold tracking-[0.3em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</p>
        </div>

        <form onSubmit={submit} className="rounded-xl p-8 space-y-5" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-5 h-5" style={{ color: GOLD }} />
            <h1 className="text-lg font-bold text-white">Book a meeting</h1>
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: '#666666' }}>Meeting Type</label>
            <div className="grid grid-cols-2 gap-2">
              {MEETING_TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => setMeetingType(t.id)} className="px-3 py-2.5 text-xs font-bold rounded-lg text-left" style={{ background: meetingType === t.id ? GOLD : 'transparent', color: meetingType === t.id ? '#080808' : '#999999', border: `1px solid ${meetingType === t.id ? GOLD : '#2A2A2A'}` }}>
                  {t.label}<br /><span className="font-normal opacity-70">{t.minutes} min</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: '#666666' }}>Date</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const iso = d.toISOString().slice(0, 10)
                return (
                  <button key={iso} type="button" onClick={() => { setDate(iso); setTime('') }} className="flex-shrink-0 px-3 py-2 text-xs font-bold rounded-lg" style={{ background: date === iso ? GOLD : 'transparent', color: date === iso ? '#080808' : '#999999', border: `1px solid ${date === iso ? GOLD : '#2A2A2A'}` }}>
                    {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </button>
                )
              })}
            </div>
          </div>

          {date && (
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: '#666666' }}>Time (ET)</label>
              {slots.length === 0 ? (
                <p className="text-xs" style={{ color: '#666666' }}>No open times this day — pick another date.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button key={s} type="button" onClick={() => setTime(s)} className="px-2 py-2 text-xs font-bold rounded-lg" style={{ background: time === s ? GOLD : 'transparent', color: time === s ? '#080808' : '#999999', border: `1px solid ${time === s ? GOLD : '#2A2A2A'}` }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input required style={inputStyle} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input style={inputStyle} placeholder="Business (optional)" value={business} onChange={(e) => setBusiness(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="email" style={inputStyle} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="tel" style={inputStyle} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

          <button type="submit" disabled={booking} className="w-full py-3.5 text-xs font-bold tracking-[0.2em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: booking ? 0.6 : 1 }}>
            {booking ? 'Booking…' : 'Confirm Booking'}
          </button>
        </form>
      </div>
    </div>
  )
}
