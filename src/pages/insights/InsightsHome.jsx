import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { LineChart as LineChartIcon, AlertTriangle, RefreshCcw, FileText } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { InsightsAPI } from '../../lib/api'
import { supabase } from '../../lib/supabase'

const GOLD = '#C8A96E'

export default function InsightsHome() {
  const [briefing, setBriefing] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [anomalies, setAnomalies] = useState([])
  const [chartData, setChartData] = useState([])
  const [archive, setArchive] = useState([])
  const [loading, setLoading] = useState(true)

  const loadBriefing = async () => {
    if (!supabase) return
    const { data } = await supabase.from('nova_insights_briefings').select('*').eq('briefing_type', 'daily').order('created_at', { ascending: false }).limit(1)
    setBriefing(data?.[0] || null)
  }

  const loadArchive = async () => {
    if (!supabase) return
    const { data } = await supabase.from('nova_insights_briefings').select('*').order('created_at', { ascending: false }).limit(10)
    setArchive(data || [])
  }

  const loadChart = async () => {
    if (!supabase) return
    const days = []
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push(d) }
    const { data: calls } = await supabase.from('nova_ai_calls').select('created_at').gte('created_at', days[0].toISOString())
    const { data: deals } = await supabase.from('nova_crm_deals').select('value,created_at').gte('created_at', days[0].toISOString())
    setChartData(days.map((d) => {
      const next = new Date(d); next.setDate(next.getDate() + 1)
      const callCount = (calls || []).filter((c) => { const t = new Date(c.created_at); return t >= d && t < next }).length
      const pipeline = (deals || []).filter((v) => { const t = new Date(v.created_at); return t >= d && t < next }).reduce((s, v) => s + (Number(v.value) || 0), 0)
      return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), calls: callCount, pipeline }
    }))
  }

  useEffect(() => {
    Promise.all([loadBriefing(), loadArchive(), loadChart(), InsightsAPI.getAnomalies().then(setAnomalies).catch(() => {})]).finally(() => setLoading(false))
  }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      await InsightsAPI.generateBriefing()
      await loadBriefing()
      await loadArchive()
    } catch (err) {
      alert(err.message || 'Failed to generate briefing')
    }
    setGenerating(false)
  }

  return (
    <DashboardShell title="Nova Insights">
      <div className="rounded-xl p-8 mb-6" style={{ background: '#0E0E0E', borderLeft: `3px solid ${GOLD}`, border: '1px solid #2A2A2A', borderLeftWidth: 3, borderLeftColor: GOLD }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: GOLD }}>Today's AI Briefing</p>
          <button onClick={generate} disabled={generating} className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase rounded-lg" style={{ border: `1px solid ${GOLD}`, color: GOLD, opacity: generating ? 0.6 : 1 }}>
            <RefreshCcw className="w-3.5 h-3.5" /> {generating ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
        {loading ? (
          <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
        ) : briefing ? (
          <>
            <p className="text-base leading-relaxed" style={{ color: '#eee' }}>{briefing.briefing_text}</p>
            <p className="text-[11px] mt-4" style={{ color: '#666666' }}>{new Date(briefing.created_at).toLocaleString()}</p>
          </>
        ) : (
          <p className="text-sm" style={{ color: '#666666' }}>No briefing yet — click Regenerate to have Claude write today's.</p>
        )}
      </div>

      {anomalies.length > 0 && (
        <div className="rounded-xl p-6 mb-6" style={{ background: '#0E0E0E', border: '1px solid #f87171' }}>
          <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4" style={{ color: '#f87171' }} /><p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: '#f87171' }}>Anomalies Detected</p></div>
          {anomalies.map((a, i) => <p key={i} className="text-sm" style={{ color: '#ccc' }}>{a.explanation}</p>)}
        </div>
      )}

      <div className="rounded-xl p-6 mb-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-5" style={{ color: GOLD }}><LineChartIcon className="w-3.5 h-3.5 inline mr-1.5" />Calls &amp; Pipeline — Last 14 Days</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="date" tick={{ fill: '#666666', fontSize: 10 }} interval={2} />
            <YAxis tick={{ fill: '#666666', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#0E0E0E', border: '1px solid #2A2A2A', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
            <Line type="monotone" dataKey="calls" name="Calls" stroke="#a78bfa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pipeline" name="Pipeline $" stroke={GOLD} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase px-6 py-4" style={{ color: GOLD, borderBottom: '1px solid #2A2A2A' }}><FileText className="w-3.5 h-3.5 inline mr-1.5" />Briefing Archive</p>
        {archive.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>No briefings generated yet.</p>
        ) : archive.map((b) => (
          <div key={b.id} className="px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${GOLD}18`, color: GOLD }}>{b.briefing_type}</span>
              <span className="text-[11px]" style={{ color: '#666666' }}>{new Date(b.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm mt-2" style={{ color: '#ccc' }}>{b.briefing_text}</p>
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}
