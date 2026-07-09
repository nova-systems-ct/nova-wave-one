import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardShell from '../../components/DashboardShell'
import { api } from '../../lib/api'

const GOLD = '#C8A96E'
const inputStyle = { width: '100%', padding: '11px 14px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }
const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666666', marginBottom: 7 }

export default function AgentCreate() {
  const navigate = useNavigate()
  const [agentName, setAgentName] = useState('Nova')
  const [businessName, setBusinessName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const create = async (e) => {
    e.preventDefault()
    if (!businessName.trim()) { setError('Business name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const result = await api.post('/api/nova-voice?action=create_agent', { agent_name: agentName, business_name: businessName })
      navigate(`/dashboard/agents/${result.agent?.id || ''}`)
    } catch (err) {
      setError(err.message || 'Failed to create agent.')
    }
    setSaving(false)
  }

  return (
    <DashboardShell title="Create Agent">
      {error && <p className="text-xs mb-4" style={{ color: '#f87171' }}>{error}</p>}
      <form onSubmit={create} className="max-w-lg rounded-xl p-8" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <div className="mb-5">
          <label style={labelStyle}>Business Name</label>
          <input style={inputStyle} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="mb-6">
          <label style={labelStyle}>Agent Name</label>
          <input style={inputStyle} value={agentName} onChange={(e) => setAgentName(e.target.value)} />
        </div>
        <button type="submit" disabled={saving} className="w-full py-3.5 text-xs font-bold uppercase tracking-[0.2em] rounded-lg" style={{ background: GOLD, color: '#080808', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Creating…' : 'Create Agent'}
        </button>
      </form>
    </DashboardShell>
  )
}
