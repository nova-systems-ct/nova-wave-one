import { useEffect, useState } from 'react'
import { Workflow, Plus, History } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { FlowAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TRIGGER_TYPES = ['new_lead', 'audit_complete', 'meeting_booked', 'meeting_cancelled', 'no_show', 'payment_received', 'review_received', 'lead_went_cold', 'client_churned', 'manual']
const ACTION_TYPES = ['send_sms', 'send_email', 'send_whatsapp', 'create_crm_activity', 'update_lead_status', 'send_notification_to_isaac', 'wait']

const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

export default function FlowHome() {
  const [workflows, setWorkflows] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('new_lead')
  const [actions, setActions] = useState([{ type: 'send_sms', body: '' }])

  const load = () => {
    Promise.all([FlowAPI.getWorkflows(), FlowAPI.getRuns()]).then(([w, r]) => {
      setWorkflows(Array.isArray(w) ? w : [])
      setRuns(Array.isArray(r) ? r : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const toggle = async (wf) => {
    await FlowAPI.toggleWorkflow({ id: wf.id, active: !wf.active }).catch(() => {})
    load()
  }

  const create = async () => {
    if (!name.trim()) return
    await FlowAPI.createWorkflow({ name, trigger_type: trigger, actions }).catch((err) => alert(err.message))
    setShowForm(false); setName(''); setActions([{ type: 'send_sms', body: '' }])
    load()
  }

  return (
    <DashboardShell title="Nova Flow">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm max-w-xl" style={{ color: '#999999' }}>Automatic sequences connecting every engine. Triggers fire when the matching event happens anywhere in Wave One.</p>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>
          <Plus className="w-3.5 h-3.5" /> Create Workflow
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-6 mb-6" style={{ background: '#0E0E0E', border: `1px solid ${GOLD}40` }}>
          <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Workflow name" value={name} onChange={(e) => setName(e.target.value)} />
          <select style={{ ...inputStyle, marginBottom: 12 }} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          {actions.map((a, i) => (
            <div key={i} className="grid grid-cols-[160px_1fr] gap-2 mb-2">
              <select style={inputStyle} value={a.type} onChange={(e) => setActions((prev) => prev.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))}>
                {ACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <input style={inputStyle} placeholder="Message / details" value={a.body || ''} onChange={(e) => setActions((prev) => prev.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))} />
            </div>
          ))}
          <button onClick={() => setActions((prev) => [...prev, { type: 'send_sms', body: '' }])} className="text-[11px] font-bold uppercase mb-4" style={{ color: GOLD }}>+ Add Step</button>
          <button onClick={create} className="block px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>Save Workflow</button>
        </div>
      )}

      <div className="rounded-xl overflow-hidden mb-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase px-6 py-4" style={{ color: GOLD, borderBottom: '1px solid #2A2A2A' }}><Workflow className="w-3.5 h-3.5 inline mr-1.5" />Workflows</p>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>Loading…</p>
        ) : workflows.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>No workflows yet.</p>
        ) : workflows.map((w) => (
          <div key={w.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <div>
              <p className="text-sm font-semibold text-white">{w.name}</p>
              <p className="text-[11px]" style={{ color: '#666666' }}>Trigger: {w.trigger_type?.replace(/_/g, ' ')} · {(w.actions || []).length} steps · run {w.run_count || 0}x</p>
            </div>
            <button onClick={() => toggle(w)} className="px-4 py-1.5 text-[11px] font-bold uppercase rounded-full" style={{ background: w.active ? '#4ade8018' : '#66666618', color: w.active ? '#4ade80' : '#999999', border: `1px solid ${w.active ? '#4ade80' : '#666666'}` }}>
              {w.active ? 'Active' : 'Paused'}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase px-6 py-4" style={{ color: GOLD, borderBottom: '1px solid #2A2A2A' }}><History className="w-3.5 h-3.5 inline mr-1.5" />Run History</p>
        {runs.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No runs yet.</p> : runs.slice(0, 20).map((r) => (
          <div key={r.id} className="flex items-center justify-between px-6 py-3 text-xs" style={{ borderBottom: '1px solid #2A2A2A', color: '#ccc' }}>
            <span>{r.status}</span>
            <span style={{ color: '#666666' }}>{new Date(r.started_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}
