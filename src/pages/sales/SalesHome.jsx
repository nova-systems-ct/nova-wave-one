import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, MessageCircle, FileText } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { SalesAPI, CRMAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Prospects', 'Coach', 'Proposals']
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

function ProspectsTab() {
  const navigate = useNavigate()
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [scoring, setScoring] = useState('')

  const load = () => SalesAPI.getProspects().then((d) => setProspects(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const scoreLead = async (id) => {
    setScoring(id)
    try { await SalesAPI.scoreLead({ contact_id: id }); load() } catch (err) { alert(err.message) }
    setScoring('')
  }

  if (loading) return <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <div className="grid grid-cols-[1fr_90px_100px_120px] gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#666666', borderBottom: '1px solid #2A2A2A' }}>
        <span>Business</span><span>Score</span><span>Status</span><span></span>
      </div>
      {prospects.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No prospects yet — leads populate automatically from every engine.</p> : prospects.map((p) => (
        <div key={p.id} className="grid grid-cols-[1fr_90px_100px_120px] gap-2 px-5 py-3 text-xs items-center" style={{ borderBottom: '1px solid #2A2A2A', color: '#ccc' }}>
          <button onClick={() => navigate(`/dashboard/crm/contact/${p.id}`)} className="text-left truncate" style={{ color: '#fff' }}>{p.business_name || 'Unnamed'}</button>
          <span style={{ color: p.lead_score >= 70 ? '#4ade80' : p.lead_score >= 40 ? GOLD : '#f87171' }}>{p.lead_score || '—'}</span>
          <span className="capitalize">{(p.status || '').replace('_', ' ')}</span>
          <button onClick={() => scoreLead(p.id)} disabled={scoring === p.id} className="text-[10px] font-bold uppercase" style={{ color: GOLD }}>{scoring === p.id ? 'Scoring…' : 'Re-score'}</button>
        </div>
      ))}
    </div>
  )
}

function CoachTab() {
  const [coaching, setCoaching] = useState([])
  const [contacts, setContacts] = useState([])
  const [contactId, setContactId] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState('')
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    SalesAPI.getCoaching().then((d) => setCoaching(Array.isArray(d) ? d : [])).catch(() => {})
    CRMAPI.getContacts({ limit: 100 }).then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const submit = async () => {
    if (!contactId || !notes.trim()) return
    setLogging(true)
    try {
      const data = await SalesAPI.logCall({ contact_id: contactId, outcome_notes: notes })
      setResult(data.coaching)
      setNotes('')
    } catch (err) { alert(err.message) }
    setLogging(false)
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Log a Call</p>
        <select style={{ ...inputStyle, marginBottom: 10 }} value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">Select contact…</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
        <textarea style={{ ...inputStyle, minHeight: 100, marginBottom: 10 }} placeholder="What happened on the call?" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button onClick={submit} disabled={logging} className="px-4 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>{logging ? 'Analyzing…' : 'Get Coaching'}</button>
        {result && <div className="mt-4 p-4 rounded-lg text-sm" style={{ background: '#080808', color: '#ccc' }}>{result}</div>}
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase px-6 py-4" style={{ color: GOLD, borderBottom: '1px solid #2A2A2A' }}>Coaching History</p>
        {coaching.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No coaching logged yet.</p> : coaching.map((c) => (
          <div key={c.id} className="px-6 py-3 text-xs" style={{ borderBottom: '1px solid #2A2A2A', color: '#ccc' }}>{c.summary}</div>
        ))}
      </div>
    </div>
  )
}

function ProposalsTab() {
  const [contacts, setContacts] = useState([])
  const [contactId, setContactId] = useState('')
  const [proposal, setProposal] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { CRMAPI.getContacts({ limit: 100 }).then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {}) }, [])

  const generate = async () => {
    if (!contactId) return
    setGenerating(true)
    try { setProposal((await SalesAPI.generateProposal({ contact_id: contactId })).proposal) } catch (err) { alert(err.message) }
    setGenerating(false)
  }

  return (
    <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}><FileText className="w-3.5 h-3.5 inline mr-1.5" />Generate Proposal</p>
      <div className="flex gap-3 mb-4">
        <select style={inputStyle} value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">Select contact…</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
        <button onClick={generate} disabled={generating} className="px-5 py-2.5 text-xs font-bold uppercase rounded-lg flex-shrink-0" style={{ background: GOLD, color: '#080808' }}>{generating ? 'Generating…' : 'Generate'}</button>
      </div>
      {proposal && (
        <div className="p-5 rounded-lg" style={{ background: '#080808', border: '1px solid #2A2A2A' }}>
          <p className="text-lg font-bold text-white">{proposal.business_name}</p>
          <p className="text-sm mt-1" style={{ color: '#999999' }}>{proposal.city} · {proposal.industry}</p>
          {proposal.overall_score != null && <p className="text-sm mt-3" style={{ color: '#ccc' }}>Audit score: <b style={{ color: GOLD }}>{proposal.overall_score}</b> · Monthly leak: <b style={{ color: '#f87171' }}>${(proposal.revenue_leak_monthly || 0).toLocaleString()}</b></p>}
          <p className="text-sm mt-2" style={{ color: '#ccc' }}>Recommended: {proposal.recommended_engines.join(', ')}</p>
          <p className="text-sm mt-2" style={{ color: GOLD }}>{proposal.investment}</p>
        </div>
      )}
    </div>
  )
}

export default function SalesHome() {
  const [tab, setTab] = useState('Prospects')
  return (
    <DashboardShell title="Nova Sales">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}><TrendingUp className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />AI sales department — lead scoring, coaching, and proposal generation on top of Nova CRM.</p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{ letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent' }}>{t}</button>
        ))}
      </div>
      {tab === 'Prospects' && <ProspectsTab />}
      {tab === 'Coach' && <CoachTab />}
      {tab === 'Proposals' && <ProposalsTab />}
    </DashboardShell>
  )
}
