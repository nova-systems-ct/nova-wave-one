import { useEffect, useState } from 'react'
import { Star, Send, RefreshCcw } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { ReviewsAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Recent Reviews', 'Request Reviews', 'Analytics']
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

function RecentTab() {
  const [reviews, setReviews] = useState([])
  const [placeId, setPlaceId] = useState('')
  const [fetching, setFetching] = useState(false)

  const load = () => ReviewsAPI.getReviews({}).then((d) => setReviews(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const fetchNew = async () => {
    if (!placeId.trim()) return
    setFetching(true)
    try { await ReviewsAPI.fetchReviews(); load() } catch (err) { alert(err.message) }
    setFetching(false)
  }

  const genResponse = async (id) => {
    const data = await ReviewsAPI.generateResponse({ id }).catch((err) => { alert(err.message); return null })
    if (data) load()
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input style={inputStyle} placeholder="Google Place ID" value={placeId} onChange={(e) => setPlaceId(e.target.value)} />
        <button onClick={fetchNew} disabled={fetching} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase rounded-lg flex-shrink-0" style={{ background: GOLD, color: '#080808' }}><RefreshCcw className="w-3.5 h-3.5" /> {fetching ? 'Fetching…' : 'Fetch Reviews'}</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        {reviews.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No reviews yet.</p> : reviews.map((r) => (
          <div key={r.id} className="px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{r.reviewer_name}</span>
              <span style={{ color: GOLD }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
            </div>
            <p className="text-sm mt-1" style={{ color: '#ccc' }}>{r.review_text}</p>
            {r.ai_response ? (
              <div className="mt-3 p-3 rounded-lg" style={{ background: '#080808', border: `1px solid ${GOLD}40` }}><p className="text-xs" style={{ color: GOLD }}>AI Response</p><p className="text-sm mt-1" style={{ color: '#ccc' }}>{r.ai_response}</p></div>
            ) : (
              <button onClick={() => genResponse(r.id)} className="mt-3 text-[11px] font-bold uppercase" style={{ color: GOLD }}>Generate AI Response</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RequestTab() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState('')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')

  const send = async () => {
    setSending(true); setResult('')
    try { await ReviewsAPI.requestReview({ name, phone, business_name: business, review_link: link }); setResult('Sent ✓') } catch (err) { setResult(err.message) }
    setSending(false)
  }

  return (
    <div className="max-w-md rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Business name" value={business} onChange={(e) => setBusiness(e.target.value)} />
      <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Google review link" value={link} onChange={(e) => setLink(e.target.value)} />
      <button onClick={send} disabled={sending} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}><Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send Request'}</button>
      {result && <p className="text-xs mt-3" style={{ color: GOLD }}>{result}</p>}
    </div>
  )
}

function AnalyticsTab() {
  const [data, setData] = useState(null)
  useEffect(() => { ReviewsAPI.getReviews ? null : null }, [])
  useEffect(() => { fetch('/api/nova-reviews?action=get_analytics').then((r) => r.json()).then(setData).catch(() => {}) }, [])
  if (!data) return <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
  return (
    <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <p className="text-4xl font-bold" style={{ color: GOLD }}>{data.average ? data.average.toFixed(1) : '—'}</p>
      <p className="text-xs mt-1" style={{ color: '#666666' }}>Average rating across {data.total} reviews</p>
    </div>
  )
}

export default function ReviewsHome() {
  const [tab, setTab] = useState('Recent Reviews')
  return (
    <DashboardShell title="Nova Reviews">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}><Star className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />Monitors reviews, drafts AI responses, and requests new reviews after appointments.</p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{ letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent' }}>{t}</button>
        ))}
      </div>
      {tab === 'Recent Reviews' && <RecentTab />}
      {tab === 'Request Reviews' && <RequestTab />}
      {tab === 'Analytics' && <AnalyticsTab />}
    </DashboardShell>
  )
}
