import { useEffect, useState } from 'react'
import { Image, Sparkles } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { MediaAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Generate Content', 'Content Calendar', 'Asset Library']
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

function GenerateTab() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [format, setFormat] = useState('post')
  const [result, setResult] = useState(null)
  const [generating, setGenerating] = useState(false)

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    try { setResult(await MediaAPI.generateCaption({ topic, platform, format })) } catch (err) { alert(err.message) }
    setGenerating(false)
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <textarea style={{ ...inputStyle, minHeight: 90, marginBottom: 10 }} placeholder="Topic or idea…" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select style={inputStyle} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {['instagram', 'facebook', 'tiktok', 'linkedin'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select style={inputStyle} value={format} onChange={(e) => setFormat(e.target.value)}>
            {['post', 'reel', 'story', 'carousel'].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <button onClick={generate} disabled={generating} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}><Sparkles className="w-3.5 h-3.5" /> {generating ? 'Generating…' : 'Generate'}</button>
      </div>
      {result && (
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold uppercase mb-2" style={{ color: GOLD }}>Caption</p>
          <p className="text-sm mb-4" style={{ color: '#ccc' }}>{result.caption}</p>
          {result.script && <><p className="text-xs font-bold uppercase mb-2" style={{ color: GOLD }}>Script</p><p className="text-sm mb-4 whitespace-pre-wrap" style={{ color: '#ccc' }}>{result.script}</p></>}
          {result.hashtags?.length > 0 && <p className="text-xs" style={{ color: '#666666' }}>{result.hashtags.map((h) => `#${h.replace('#', '')}`).join(' ')}</p>}
        </div>
      )}
    </div>
  )
}

function CalendarTab() {
  const [industry, setIndustry] = useState('')
  const [calendar, setCalendar] = useState([])
  const [generating, setGenerating] = useState(false)

  const generate = async () => {
    setGenerating(true)
    try { setCalendar((await MediaAPI.generateCalendar({ industry, days: 30 })).calendar || []) } catch (err) { alert(err.message) }
    setGenerating(false)
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input style={inputStyle} placeholder="Client industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        <button onClick={generate} disabled={generating} className="px-5 py-2.5 text-xs font-bold uppercase rounded-lg flex-shrink-0" style={{ background: GOLD, color: '#080808' }}>{generating ? 'Generating…' : 'Generate 30-Day Calendar'}</button>
      </div>
      {calendar.length > 0 && (
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-2">
          {calendar.map((d, i) => (
            <div key={i} className="p-3 rounded-lg" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
              <p className="text-[10px] font-bold" style={{ color: GOLD }}>Day {d.day}</p>
              <p className="text-[11px] mt-1" style={{ color: '#999999' }}>{d.platform} · {d.format}</p>
              <p className="text-xs mt-1" style={{ color: '#ccc' }}>{d.topic}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssetsTab() {
  const [assets, setAssets] = useState([])
  useEffect(() => { MediaAPI.getAssets().then((d) => setAssets(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
  if (assets.length === 0) return <p className="text-sm" style={{ color: '#666666' }}>No assets generated yet.</p>
  return (
    <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
      {assets.map((a) => (
        <div key={a.id} className="rounded-lg overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          {a.image_url ? <img src={a.image_url} alt={a.title} className="w-full aspect-square object-cover" /> : <div className="p-4"><p className="text-xs" style={{ color: '#ccc' }}>{a.title}</p></div>}
        </div>
      ))}
    </div>
  )
}

export default function MediaHome() {
  const [tab, setTab] = useState('Generate Content')
  return (
    <DashboardShell title="Nova Media">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}><Image className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />AI creative studio — captions, scripts, hashtags, and content calendars.</p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{ letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent' }}>{t}</button>
        ))}
      </div>
      {tab === 'Generate Content' && <GenerateTab />}
      {tab === 'Content Calendar' && <CalendarTab />}
      {tab === 'Asset Library' && <AssetsTab />}
    </DashboardShell>
  )
}
