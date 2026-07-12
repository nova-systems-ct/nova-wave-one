import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, FileText, CalendarClock, MessageSquare, Upload } from 'lucide-react'
import NovaLogo from '../../components/NovaLogo'
import { ClientAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Overview', 'Invoices', 'Messages', 'Files']
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

export default function ClientDashboard() {
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [data, setData] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [messages, setMessages] = useState([])
  const [files, setFiles] = useState([])
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('nova_client_account')
    if (!raw) { navigate('/client/login'); return }
    const acc = JSON.parse(raw)
    setAccount(acc)
    ClientAPI.getClientData(acc.id).then(setData).catch(() => {})
    ClientAPI.getInvoices(acc.email).then((d) => setInvoices(Array.isArray(d) ? d : [])).catch(() => {})
    ClientAPI.getMessages(acc.id).then((d) => setMessages(Array.isArray(d) ? d : [])).catch(() => {})
    ClientAPI.getFiles(acc.id).then((d) => setFiles(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const logout = () => { localStorage.removeItem('nova_client_account'); navigate('/client/login') }

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    await ClientAPI.sendMessage({ client_account_id: account.id, message: newMessage }).catch(() => {})
    setMessages((prev) => [...prev, { id: Date.now(), direction: 'from_client', message: newMessage, created_at: new Date().toISOString() }])
    setNewMessage('')
  }

  if (!account) return null

  return (
    <div className="min-h-screen" style={{ background: '#080808' }}>
      <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid #2A2A2A' }}>
        <div className="flex items-center gap-3">
          <NovaLogo size={26} />
          <div><p className="text-sm font-bold text-white">{account.business_name}</p><p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: GOLD }}>Client Portal</p></div>
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-xs font-bold uppercase" style={{ color: '#999999' }}><LogOut className="w-3.5 h-3.5" /> Sign Out</button>
      </div>

      <div className="px-8 py-6">
        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-2 text-xs font-bold uppercase rounded-lg" style={{ border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent' }}>{t}</button>
          ))}
        </div>

        {tab === 'Overview' && data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['Calls Answered', data.stats.calls], ['Texts Sent', data.stats.texts], ['Reviews Requested', data.stats.reviews], ['Leads Captured', data.stats.leads]].map(([label, val]) => (
              <div key={label} className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
                <p className="text-3xl font-bold" style={{ color: GOLD }}>{val}</p>
                <p className="text-xs mt-1" style={{ color: '#999999' }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'Invoices' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            {invoices.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No invoices yet.</p> : invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
                <div><p className="text-sm text-white">${Number(inv.total).toLocaleString()}</p><p className="text-[11px]" style={{ color: '#666666' }}>{inv.status}</p></div>
                {inv.stripe_payment_link && inv.status !== 'paid' && <a href={inv.stripe_payment_link} target="_blank" rel="noreferrer" className="px-4 py-2 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>Pay Now</a>}
              </div>
            ))}
          </div>
        )}

        {tab === 'Messages' && (
          <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <div className="space-y-3 mb-4" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {messages.map((m) => (
                <div key={m.id} className="flex" style={{ justifyContent: m.direction === 'from_client' ? 'flex-end' : 'flex-start' }}>
                  <div className="max-w-[70%] px-4 py-2.5 rounded-xl text-sm" style={m.direction === 'from_client' ? { background: GOLD, color: '#080808' } : { background: '#1A1A1A', color: '#fff' }}>{m.message}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2"><input style={inputStyle} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Message the Nova Systems team…" /><button onClick={sendMessage} className="px-4 py-2.5 text-xs font-bold uppercase rounded-lg flex-shrink-0" style={{ background: GOLD, color: '#080808' }}>Send</button></div>
          </div>
        )}

        {tab === 'Files' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            {files.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No files yet.</p> : files.map((f) => (
              <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-6 py-3 text-sm" style={{ borderBottom: '1px solid #2A2A2A', color: '#ccc' }}><FileText className="w-4 h-4" style={{ color: GOLD }} />{f.file_name}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
