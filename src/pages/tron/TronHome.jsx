import { useEffect, useState } from 'react'
import { Radio, RefreshCcw, AlertTriangle } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { TronAPI } from '../../lib/api'

const GOLD = '#C8A96E'

function fmt(item) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') return item.caption || item.angle || item.title || JSON.stringify(item)
  return String(item)
}

export default function TronHome() {
  const [latest, setLatest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = () => TronAPI.getLatest().then(setLatest).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const run = async () => {
    setRunning(true)
    try { await TronAPI.runAnalysis(); await load() } catch (err) { alert(err.message) }
    setRunning(false)
  }

  return (
    <DashboardShell title="Nova Tron">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm max-w-xl" style={{ color: '#999999' }}><Radio className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />World intelligence — Google Trends, Reddit, and Hacker News analyzed by Claude every 6 hours.</p>
        <button onClick={run} disabled={running} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase rounded-lg flex-shrink-0" style={{ background: GOLD, color: '#080808', opacity: running ? 0.6 : 1 }}>
          <RefreshCcw className="w-3.5 h-3.5" /> {running ? 'Analyzing…' : 'Run Analysis Now'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
      ) : !latest ? (
        <div className="rounded-xl py-16 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-sm" style={{ color: '#666666' }}>No intelligence yet — click Run Analysis Now.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Connecticut Opportunities</p>
            {(latest.connecticut_opportunities || []).length === 0 ? <p className="text-sm" style={{ color: '#666666' }}>None found.</p> : (latest.connecticut_opportunities || []).map((o, i) => <p key={i} className="text-sm mb-2" style={{ color: '#ccc' }}>{fmt(o)}</p>)}
          </div>
          <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>AI Developments</p>
            {(latest.ai_developments || []).length === 0 ? <p className="text-sm" style={{ color: '#666666' }}>None found.</p> : (latest.ai_developments || []).map((o, i) => <p key={i} className="text-sm mb-2" style={{ color: '#ccc' }}>{fmt(o)}</p>)}
          </div>
          <div className="rounded-xl p-6 lg:col-span-2" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Content Ideas</p>
            <div className="grid md:grid-cols-2 gap-3">
              {(latest.content_ideas || []).map((idea, i) => (
                <div key={i} className="p-4 rounded-lg" style={{ background: '#080808', border: '1px solid #2A2A2A' }}>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${GOLD}18`, color: GOLD }}>{idea.platform} · {idea.format}</span>
                  <p className="text-sm mt-2" style={{ color: '#ccc' }}>{idea.caption || idea.angle}</p>
                </div>
              ))}
            </div>
          </div>
          {(latest.alerts || []).length > 0 && (
            <div className="rounded-xl p-6 lg:col-span-2" style={{ background: '#0E0E0E', border: '1px solid #f87171' }}>
              <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: '#f87171' }}><AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />Alerts</p>
              {(latest.alerts || []).map((a, i) => <p key={i} className="text-sm mb-2" style={{ color: '#ccc' }}>{fmt(a)}</p>)}
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  )
}
