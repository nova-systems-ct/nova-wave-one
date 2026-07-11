import { useEffect, useState } from 'react'
import { Phone, PhoneCall, Settings as SettingsIcon, PlayCircle } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { VoiceAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Call Logs', 'Make a Call', 'Settings']

const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }
const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666666', marginBottom: 7 }
const tabBtn = (active) => ({
  padding: '9px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  borderRadius: 8, border: `1px solid ${active ? GOLD : '#2A2A2A'}`, color: active ? '#080808' : '#999999',
  background: active ? GOLD : 'transparent', cursor: 'pointer',
})

const OUTCOME_COLOR = { completed: '#4ade80', 'in-progress': GOLD, 'no-answer': '#f87171', busy: '#f87171', failed: '#f87171', pending: '#666666' }

function CallLogsTab() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    VoiceAPI.getCalls({ limit: 100 }).then((d) => setCalls(Array.isArray(d) ? d : [])).catch(() => setCalls([])).finally(() => setLoading(false))
  }, [])

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4">
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <div className="grid grid-cols-[80px_1fr_100px_80px_100px] gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#666666', borderBottom: '1px solid #2A2A2A' }}>
          <span>Direction</span><span>Phone</span><span>Duration</span><span>Outcome</span><span>Date</span>
        </div>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>Loading…</p>
        ) : calls.length === 0 ? (
          <div className="py-16 text-center">
            <Phone className="w-8 h-8 mx-auto mb-4" style={{ color: '#2A2A2A' }} />
            <p className="text-sm" style={{ color: '#666666' }}>No calls logged yet.</p>
          </div>
        ) : calls.map((c) => (
          <button key={c.id} onClick={() => setSelected(c)} className="w-full grid grid-cols-[80px_1fr_100px_80px_100px] gap-2 px-5 py-3 text-left text-xs" style={{ borderBottom: '1px solid #2A2A2A', background: selected?.id === c.id ? 'rgba(200,169,110,0.06)' : 'transparent', color: '#ccc' }}>
            <span className="capitalize">{c.direction || 'inbound'}</span>
            <span className="truncate" style={{ color: '#fff' }}>{c.caller_phone || 'unknown'}</span>
            <span>{c.duration ? `${c.duration}s` : '—'}</span>
            <span style={{ color: OUTCOME_COLOR[c.outcome] || '#999999' }}>{c.outcome || 'pending'}</span>
            <span style={{ color: '#666666' }}>{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A', minHeight: 300 }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Call Detail</p>
        {!selected ? (
          <p className="text-sm" style={{ color: '#666666' }}>Select a call to view its transcript.</p>
        ) : (
          <>
            <p className="text-sm mb-1" style={{ color: '#fff' }}>{selected.caller_phone}</p>
            <p className="text-xs mb-4" style={{ color: '#666666' }}>{new Date(selected.created_at).toLocaleString()}</p>
            {selected.recording_url && (
              <a href={selected.recording_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold uppercase mb-4" style={{ color: GOLD }}>
                <PlayCircle className="w-4 h-4" /> Play Recording
              </a>
            )}
            <div className="rounded-lg p-4" style={{ background: '#080808', border: '1px solid #2A2A2A', maxHeight: 300, overflowY: 'auto' }}>
              <p className="text-xs whitespace-pre-wrap" style={{ color: '#ccc' }}>{selected.transcript || 'No transcript available for this call.'}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MakeCallTab() {
  const [agents, setAgents] = useState([])
  const [to, setTo] = useState('')
  const [agentId, setAgentId] = useState('')
  const [purpose, setPurpose] = useState('follow_up')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    VoiceAPI.getAgents().then((d) => {
      const rows = Array.isArray(d) ? d : []
      setAgents(rows)
      if (rows[0]) setAgentId(rows[0].id)
    }).catch(() => {})
  }, [])

  const call = async () => {
    setError(''); setResult(null)
    if (!to.trim() || !agentId) { setError('A phone number and agent are required.'); return }
    setRunning(true)
    try {
      const data = await VoiceAPI.makeCall({ to, agent_id: agentId, call_purpose: purpose })
      setResult(data)
    } catch (err) {
      setError(err.message || 'Call failed')
    }
    setRunning(false)
  }

  return (
    <div className="max-w-xl rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <div className="mb-4">
        <label style={labelStyle}>Phone Number</label>
        <input style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} placeholder="2035551234" />
      </div>
      <div className="mb-4">
        <label style={labelStyle}>Agent</label>
        <select style={inputStyle} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {agents.length === 0 && <option value="">No agents yet — create one first</option>}
          {agents.map((a) => <option key={a.id} value={a.id}>{a.agent_name} — {a.business_name}</option>)}
        </select>
      </div>
      <div className="mb-6">
        <label style={labelStyle}>Call Purpose</label>
        <div className="flex gap-2 flex-wrap">
          {[
            ['appointment_reminder', 'Appointment Reminder'],
            ['follow_up', 'Follow Up'],
            ['cold_outreach', 'Cold Outreach'],
            ['reactivation', 'Reactivation'],
          ].map(([val, label]) => (
            <button key={val} onClick={() => setPurpose(val)} className="px-3 py-2 text-[11px] font-bold uppercase rounded-lg"
              style={{ background: purpose === val ? GOLD : 'transparent', color: purpose === val ? '#080808' : '#999999', border: `1px solid ${purpose === val ? GOLD : '#2A2A2A'}` }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs mb-4" style={{ color: '#f87171' }}>{error}</p>}
      {result && <p className="text-xs mb-4" style={{ color: GOLD }}>Call placed — SID {result.call_sid}, status {result.status}.</p>}
      <button onClick={call} disabled={running} className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] rounded-lg" style={{ background: GOLD, color: '#080808', opacity: running ? 0.6 : 1 }}>
        <PhoneCall className="w-3.5 h-3.5" /> {running ? 'Calling…' : 'Make Call'}
      </button>
    </div>
  )
}

function SettingsTab() {
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(true)

  const check = () => {
    setChecking(true)
    VoiceAPI.renderStatus().then(setStatus).catch(() => setStatus({ configured: false, connected: false })).finally(() => setChecking(false))
  }

  useEffect(() => { check() }, [])

  return (
    <div className="max-w-xl rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Render Stream Server</p>
      <p className="text-sm mb-5" style={{ color: '#999999' }}>
        Real-time voice conversations (Deepgram + Claude + ElevenLabs) run on an always-on server deployed to Render.com, since Vercel functions can't hold a WebSocket open for a call's duration. Set <code>RENDER_STREAM_URL</code> once it's deployed — see <code>render-server/README.md</code>.
      </p>
      <div className="flex items-center gap-3 mb-5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: checking ? '#666666' : status?.connected ? '#4ade80' : '#f87171' }} />
        <span className="text-sm font-semibold" style={{ color: '#fff' }}>
          {checking ? 'Checking…' : !status?.configured ? 'Not configured' : status.connected ? 'Connected' : 'Configured but unreachable'}
        </span>
      </div>
      {!status?.configured && !checking && (
        <p className="text-xs mb-5" style={{ color: '#666666' }}>Until this is set, inbound and outbound calls fall back to pre-recorded TwiML scripts instead of a live AI conversation — calls still work, they just aren't dynamic.</p>
      )}
      <button onClick={check} disabled={checking} className="px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff', opacity: checking ? 0.6 : 1 }}>
        Re-check
      </button>
    </div>
  )
}

export default function VoiceHome() {
  const [tab, setTab] = useState('Call Logs')
  return (
    <DashboardShell title="Nova Voice">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}>
        <SettingsIcon className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />
        AI phone agents answering every call 24/7, calling leads, and sending reminders.
      </p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>{t}</button>)}
      </div>
      {tab === 'Call Logs' && <CallLogsTab />}
      {tab === 'Make a Call' && <MakeCallTab />}
      {tab === 'Settings' && <SettingsTab />}
    </DashboardShell>
  )
}
