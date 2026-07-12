import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { DocsAPI, CRMAPI, AuditAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

export default function DocsHome() {
  const [documents, setDocuments] = useState([])
  const [contacts, setContacts] = useState([])
  const [audits, setAudits] = useState([])
  const [contactId, setContactId] = useState('')
  const [auditId, setAuditId] = useState('')
  const [generating, setGenerating] = useState('')

  const load = () => DocsAPI.getDocuments().then((d) => setDocuments(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => {
    load()
    CRMAPI.getContacts({ limit: 100 }).then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {})
    AuditAPI.list({ limit: 100 }).then((d) => setAudits(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const genProposal = async () => {
    if (!contactId) return
    setGenerating('proposal')
    try { await DocsAPI.generateProposal({ contact_id: contactId }); load() } catch (err) { alert(err.message) }
    setGenerating('')
  }
  const genDeck = async () => {
    if (!auditId) return
    setGenerating('deck')
    try { await DocsAPI.generatePitchDeck({ audit_id: auditId }); load() } catch (err) { alert(err.message) }
    setGenerating('')
  }

  return (
    <DashboardShell title="Nova Docs">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}><FileText className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />Pitch decks and proposals generated from real audit and CRM data.</p>

      <div className="grid md:grid-cols-2 gap-5 mb-6">
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold uppercase mb-3" style={{ color: GOLD }}>Generate Proposal</p>
          <select style={{ ...inputStyle, marginBottom: 10 }} value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Select contact…</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
          <button onClick={genProposal} disabled={generating === 'proposal'} className="px-4 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>{generating === 'proposal' ? 'Generating…' : 'Generate'}</button>
        </div>
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold uppercase mb-3" style={{ color: GOLD }}>Generate Pitch Deck</p>
          <select style={{ ...inputStyle, marginBottom: 10 }} value={auditId} onChange={(e) => setAuditId(e.target.value)}>
            <option value="">Select audit…</option>
            {audits.map((a) => <option key={a.id} value={a.id}>{a.business_name}</option>)}
          </select>
          <button onClick={genDeck} disabled={generating === 'deck'} className="px-4 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>{generating === 'deck' ? 'Generating…' : 'Generate'}</button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase px-6 py-4" style={{ color: GOLD, borderBottom: '1px solid #2A2A2A' }}>Document Library</p>
        {documents.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No documents generated yet.</p> : documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-6 py-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <div><p className="text-sm text-white">{d.title}</p><p className="text-[11px]" style={{ color: '#666666' }}>{d.document_type} · {new Date(d.created_at).toLocaleDateString()}</p></div>
            <code className="text-[11px]" style={{ color: GOLD }}>/dashboard/docs/view/{d.share_token}</code>
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}
