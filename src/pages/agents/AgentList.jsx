import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Plus } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { api } from '../../lib/api'

const GOLD = '#C8A96E'

export default function AgentList() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/nova-voice', { action: 'get_agents' }).then((d) => setAgents(Array.isArray(d) ? d : [])).catch(() => setAgents([])).finally(() => setLoading(false))
  }, [])

  return (
    <DashboardShell title="Agents">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm max-w-xl" style={{ color: '#999999' }}>Every Nova Voice / SMS agent, across every client.</p>
        <button onClick={() => navigate('/dashboard/agents/create')} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] rounded-lg" style={{ background: GOLD, color: '#080808' }}>
          <Plus className="w-3.5 h-3.5" /> Create Agent
        </button>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
      ) : agents.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <Bot className="w-8 h-8 mx-auto mb-4" style={{ color: '#2A2A2A' }} />
          <p className="text-sm" style={{ color: '#666666' }}>No agents yet — create your first one.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <div key={a.id} onClick={() => navigate(`/dashboard/agents/${a.id}`)} className="rounded-xl p-5 cursor-pointer" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
              <p className="text-sm font-bold text-white mb-1">{a.agent_name}</p>
              <p className="text-xs" style={{ color: '#666666' }}>{a.business_name}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
