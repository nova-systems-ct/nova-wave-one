import { useEffect, useState } from 'react'
import { UserPlus, ExternalLink } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { HireAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Job Postings', 'Applications']
const POSTINGS = [
  { id: 'account_executive', title: 'Account Executive', compensation: 'Commission only', description: 'Sell Nova Systems Wave One to Connecticut small businesses. Full training provided.' },
  { id: 'content_creator', title: 'Content Creator', compensation: 'Contract', description: 'Create social content for Nova Systems and Wave One clients.' },
]

function PostingsTab() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {POSTINGS.map((p) => (
        <div key={p.id} className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-lg font-bold text-white">{p.title}</p>
          <p className="text-xs mt-1" style={{ color: GOLD }}>{p.compensation}</p>
          <p className="text-sm mt-3" style={{ color: '#999999' }}>{p.description}</p>
          <a href="/careers/apply" target="_blank" rel="noreferrer" className="flex items-center gap-1 mt-4 text-xs font-bold uppercase" style={{ color: GOLD }}>
            Application link <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ))}
    </div>
  )
}

function ApplicationsTab() {
  const [apps, setApps] = useState([])
  const load = () => HireAPI.getApplications().then((d) => setApps(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const screen = async (id) => { await HireAPI.screenApplication({ id }).catch((err) => alert(err.message)); load() }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      {apps.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No applications yet.</p> : apps.map((a) => (
        <div key={a.id} className="px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-white">{a.name} — {a.position}</span>
            {a.ai_score != null && <span className="text-sm font-bold" style={{ color: a.ai_score >= 70 ? '#4ade80' : GOLD }}>{a.ai_score}/100</span>}
          </div>
          <p className="text-xs" style={{ color: '#666666' }}>{a.email}</p>
          {a.ai_summary ? <p className="text-sm mt-2" style={{ color: '#ccc' }}>{a.ai_summary}</p> : <button onClick={() => screen(a.id)} className="text-[11px] font-bold uppercase mt-2" style={{ color: GOLD }}>Run AI Screening</button>}
        </div>
      ))}
    </div>
  )
}

export default function HireHome() {
  const [tab, setTab] = useState('Job Postings')
  return (
    <DashboardShell title="Nova Hire">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}><UserPlus className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />AI-powered recruiting — postings, applications, and screening.</p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{ letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent' }}>{t}</button>
        ))}
      </div>
      {tab === 'Job Postings' && <PostingsTab />}
      {tab === 'Applications' && <ApplicationsTab />}
    </DashboardShell>
  )
}
