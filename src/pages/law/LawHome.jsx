import { useEffect, useState } from 'react'
import { Scale, CheckCircle, AlertCircle } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { LawAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Contracts', 'License Tracker', 'Compliance']
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

function ContractsTab() {
  const [contracts, setContracts] = useState([])
  const [type, setType] = useState('wave_one_service_agreement')
  const [clientName, setClientName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = () => LawAPI.getContracts().then((d) => setContracts(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!clientName.trim()) return
    setCreating(true)
    try { await LawAPI.createContract({ contract_type: type, fields: { client_name: clientName, date: new Date().toLocaleDateString(), amount: '997' } }); setClientName(''); load() } catch (err) { alert(err.message) }
    setCreating(false)
  }

  return (
    <div>
      <div className="rounded-xl p-6 mb-4" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="wave_one_service_agreement">Wave One Service Agreement</option>
            <option value="website_development_agreement">Website Development Agreement</option>
            <option value="social_media_management_agreement">Social Media Management Agreement</option>
            <option value="white_label_partnership_agreement">White Label Partnership Agreement</option>
          </select>
          <input style={inputStyle} placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <button onClick={create} disabled={creating} className="px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>{creating ? 'Creating…' : 'Generate Contract'}</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        {contracts.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No contracts yet.</p> : contracts.map((c) => (
          <div key={c.id} className="px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white capitalize">{c.contract_type.replace(/_/g, ' ')}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: c.signed ? '#4ade8018' : '#f59e0b18', color: c.signed ? '#4ade80' : '#f59e0b' }}>{c.signed ? 'Signed' : 'Unsigned'}</span>
            </div>
            <p className="text-xs whitespace-pre-wrap" style={{ color: '#666666' }}>{c.content?.slice(0, 200)}…</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function LicensesTab() {
  const [licenses, setLicenses] = useState([])
  useEffect(() => { LawAPI.getLicenses().then((d) => setLicenses(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      {licenses.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No licenses tracked yet — add them directly in Supabase's nova_law_licenses table for now.</p> : licenses.map((l) => (
        <div key={l.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
          <span className="text-sm text-white">{l.license_name}</span>
          <span className="text-xs" style={{ color: '#666666' }}>{l.expiry_date}</span>
        </div>
      ))}
    </div>
  )
}

function ComplianceTab() {
  const [items, setItems] = useState([])
  useEffect(() => { LawAPI.getCompliance().then((d) => setItems(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      {items.map((i) => (
        <div key={i.id} className="flex items-start gap-3 px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
          <div><p className="text-sm text-white">{i.label}</p><p className="text-xs mt-1" style={{ color: '#666666' }}>{i.check}</p></div>
        </div>
      ))}
    </div>
  )
}

export default function LawHome() {
  const [tab, setTab] = useState('Contracts')
  return (
    <DashboardShell title="Nova Law">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}><Scale className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />Legal organization for the business — not legal advice.</p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{ letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent' }}>{t}</button>
        ))}
      </div>
      {tab === 'Contracts' && <ContractsTab />}
      {tab === 'License Tracker' && <LicensesTab />}
      {tab === 'Compliance' && <ComplianceTab />}
    </DashboardShell>
  )
}
