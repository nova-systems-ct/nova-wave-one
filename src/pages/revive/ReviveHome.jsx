import { useEffect, useState } from 'react'
import { RefreshCcw, Flame, Sun, Snowflake, CloudSnow, Play, Send, XCircle } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { ReviveAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Lead Temperature', 'Campaigns', 'Logs']

const TEMP_META = {
  Hot: { icon: Flame, color: '#f87171' },
  Warm: { icon: Sun, color: GOLD },
  Cold: { icon: Snowflake, color: '#60a5fa' },
  Frozen: { icon: CloudSnow, color: '#a78bfa' },
}

const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

function money(n) {
  return n == null ? '—' : `$${Number(n).toLocaleString()}`
}

function LeadTemperatureTab() {
  const [grouped, setGrouped] = useState({ Hot: [], Warm: [], Cold: [], Frozen: [] })
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const load = () => ReviveAPI.getColdLeads().then((d) => setGrouped(d && typeof d === 'object' ? d : { Hot: [], Warm: [], Cold: [], Frozen: [] })).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const runRevival = async () => {
    setRunning(true); setError(''); setResult(null)
    try {
      const data = await ReviveAPI.checkAllLeads()
      setResult(data)
      load()
    } catch (err) {
      setError(err.message || 'Failed to run revival')
    }
    setRunning(false)
  }

  const optOut = async (leadId) => {
    await ReviveAPI.optOutLead({ lead_id: leadId, reason: 'Manual opt-out from dashboard' }).catch(() => {})
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: '#999999' }}>Hot (0–7 days), Warm (7–30), Cold (30–90), Frozen (90+) — every non-client, non-opted-out lead from the Nova Audit pipeline.</p>
        <button onClick={runRevival} disabled={running} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg flex-shrink-0" style={{ background: GOLD, color: '#080808', opacity: running ? 0.6 : 1 }}>
          <Play className="w-3.5 h-3.5" /> {running ? 'Running…' : 'Run Revival'}
        </button>
      </div>

      {error && <p className="text-xs mb-4" style={{ color: '#f87171' }}>{error}</p>}
      {result && (
        <div className="mb-5 p-4 rounded-lg text-xs grid grid-cols-2 md:grid-cols-5 gap-3" style={{ background: 'rgba(200,169,110,0.08)', border: `1px solid ${GOLD}40`, color: '#ccc' }}>
          <span>Checked: <b style={{ color: GOLD }}>{result.leads_checked}</b></span>
          <span>Hot: <b style={{ color: GOLD }}>{result.hot_count}</b></span>
          <span>Warm: <b style={{ color: GOLD }}>{result.warm_count}</b></span>
          <span>Cold: <b style={{ color: GOLD }}>{result.cold_count}</b></span>
          <span>Revived: <b style={{ color: GOLD }}>{result.revival_messages_sent}</b></span>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.entries(grouped).map(([temp, leads]) => {
            const { icon: Icon, color } = TEMP_META[temp] || TEMP_META.Warm
            return (
              <div key={temp} className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color }}>{temp}</span>
                  <span className="text-[11px] ml-auto" style={{ color: '#666666' }}>{leads.length}</span>
                </div>
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {leads.length === 0 ? (
                    <p className="p-4 text-xs" style={{ color: '#666666' }}>None.</p>
                  ) : leads.map((l) => (
                    <div key={l.id} className="px-4 py-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
                      <p className="text-sm font-semibold truncate" style={{ color: '#fff' }}>{l.business_name}</p>
                      <p className="text-[11px] mb-1" style={{ color: '#666666' }}>{l.city} · {l.days_since_contact}d since contact</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: GOLD }}>{money(l.revenue_leak_monthly)}/mo</span>
                        <button onClick={() => optOut(l.id)} className="flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: '#666666' }}>
                          <XCircle className="w-3 h-3" /> Opt Out
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CampaignsTab() {
  const [grouped, setGrouped] = useState({ Hot: [], Warm: [], Cold: [], Frozen: [] })
  const [selected, setSelected] = useState(new Set())
  const [template, setTemplate] = useState('Hey [name], just checking in on [business_name]. Still want to talk about that revenue audit?')
  const [channels, setChannels] = useState(['sms'])
  const [campaignName, setCampaignName] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { ReviveAPI.getColdLeads().then((d) => setGrouped(d || {})).catch(() => {}) }, [])

  const allLeads = Object.values(grouped).flat()
  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleChannel = (c) => setChannels((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])

  const run = async () => {
    setError(''); setResult(null)
    if (!selected.size || !template.trim() || !channels.length) { setError('Select at least one lead, a channel, and a message.'); return }
    setRunning(true)
    try {
      const data = await ReviveAPI.runCampaign({ campaign_name: campaignName || 'Revive Campaign', lead_ids: Array.from(selected), message_template: template, channels })
      setResult(data)
    } catch (err) {
      setError(err.message || 'Campaign failed')
    }
    setRunning(false)
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4">
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A', maxHeight: 500, overflowY: 'auto' }}>
        {allLeads.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>No leads to target.</p>
        ) : allLeads.map((l) => (
          <label key={l.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: '#fff' }}>{l.business_name}</p>
              <p className="text-[11px]" style={{ color: '#666666' }}>{l.lead_temperature} · {money(l.revenue_leak_monthly)}/mo</p>
            </div>
          </label>
        ))}
      </div>

      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Campaign</p>
        <input style={{ ...inputStyle, marginBottom: 12 }} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign name" />
        <textarea style={{ ...inputStyle, minHeight: 90, marginBottom: 12 }} value={template} onChange={(e) => setTemplate(e.target.value)} />
        <div className="flex gap-2 mb-4 flex-wrap">
          {['sms', 'email', 'whatsapp'].map((c) => (
            <button key={c} onClick={() => toggleChannel(c)} className="px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg" style={{ background: channels.includes(c) ? GOLD : 'transparent', color: channels.includes(c) ? '#080808' : '#999999', border: `1px solid ${channels.includes(c) ? GOLD : '#2A2A2A'}` }}>{c}</button>
          ))}
        </div>
        <p className="text-[11px] mb-4" style={{ color: '#666666' }}>{selected.size} lead{selected.size === 1 ? '' : 's'} selected</p>
        {error && <p className="text-xs mb-3" style={{ color: '#f87171' }}>{error}</p>}
        {result && <p className="text-xs mb-3" style={{ color: GOLD }}>Sent {result.sent} · Failed {result.failed_count}</p>}
        <button onClick={run} disabled={running} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg w-full justify-center" style={{ background: GOLD, color: '#080808', opacity: running ? 0.6 : 1 }}>
          <Send className="w-3.5 h-3.5" /> {running ? 'Sending…' : 'Run Campaign'}
        </button>
      </div>
    </div>
  )
}

function LogsTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { ReviveAPI.getLogs({ limit: 100 }).then((d) => setLogs(Array.isArray(d) ? d : [])).catch(() => setLogs([])).finally(() => setLoading(false)) }, [])

  if (loading) return <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
  if (logs.length === 0) {
    return (
      <div className="rounded-xl py-16 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <RefreshCcw className="w-8 h-8 mx-auto mb-4" style={{ color: '#2A2A2A' }} />
        <p className="text-sm" style={{ color: '#666666' }}>No revival attempts logged yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <div className="grid grid-cols-[100px_1fr_100px_120px] gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#666666', borderBottom: '1px solid #2A2A2A' }}>
        <span>Channel</span><span>Message</span><span>Outcome</span><span>Date</span>
      </div>
      {logs.map((l, i) => (
        <div key={l.id} className="grid grid-cols-[100px_1fr_100px_120px] gap-2 px-5 py-3 text-xs" style={{ borderBottom: i < logs.length - 1 ? '1px solid #2A2A2A' : 'none', color: '#ccc' }}>
          <span className="capitalize" style={{ color: GOLD }}>{l.channel}</span>
          <span className="truncate">{l.message}</span>
          <span style={{ color: l.outcome === 'sent' ? '#4ade80' : l.outcome === 'failed' ? '#f87171' : '#999999' }}>{l.outcome}</span>
          <span style={{ color: '#666666' }}>{new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      ))}
    </div>
  )
}

export default function ReviveHome() {
  const [tab, setTab] = useState('Lead Temperature')
  return (
    <DashboardShell title="Nova Revive">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}>
        AI reactivating every dead lead in your database — nothing falls through the cracks until it opts out.
      </p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{
            letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent',
          }}>{t}</button>
        ))}
      </div>
      {tab === 'Lead Temperature' && <LeadTemperatureTab />}
      {tab === 'Campaigns' && <CampaignsTab />}
      {tab === 'Logs' && <LogsTab />}
    </DashboardShell>
  )
}
