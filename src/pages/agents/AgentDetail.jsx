import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import DashboardShell from '../../components/DashboardShell'
import { api } from '../../lib/api'

export default function AgentDetail() {
  const { id } = useParams()
  const [agent, setAgent] = useState(undefined)

  useEffect(() => {
    api.get('/api/nova-voice', { action: 'get_agent', id }).then(setAgent).catch(() => setAgent(null))
  }, [id])

  return (
    <DashboardShell title="Agent Detail">
      {agent === undefined ? (
        <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
      ) : !agent ? (
        <p className="text-sm" style={{ color: '#666666' }}>Agent not found.</p>
      ) : (
        <div className="rounded-xl p-8 max-w-lg" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-lg font-bold text-white mb-1">{agent.agent_name}</p>
          <p className="text-sm" style={{ color: '#999999' }}>{agent.business_name}</p>
        </div>
      )}
    </DashboardShell>
  )
}
