import { useEffect, useState } from 'react'
import { MessageCircle, Send, Plus, Upload } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { SMSAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Conversations', 'Campaigns']

const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }
const tabBtn = (active) => ({
  padding: '9px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  borderRadius: 8, border: `1px solid ${active ? GOLD : '#2A2A2A'}`, color: active ? '#080808' : '#999999',
  background: active ? GOLD : 'transparent', cursor: 'pointer',
})

function ConversationsTab() {
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    SMSAPI.getConversations().then((data) => {
      const all = Array.isArray(data) ? data : []
      setConversations(all.filter((c) => c.platform === 'whatsapp'))
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!selected) return
    const loadThread = () => SMSAPI.getConversation(selected).then((data) => setMessages(Array.isArray(data) ? data.filter((m) => m.platform === 'whatsapp') : [])).catch(() => {})
    loadThread()
    const id = setInterval(loadThread, 15000)
    return () => clearInterval(id)
  }, [selected])

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      await SMSAPI.sendWhatsapp({ to: selected, message: reply })
      setReply('')
      const data = await SMSAPI.getConversation(selected)
      setMessages(Array.isArray(data) ? data.filter((m) => m.platform === 'whatsapp') : [])
      load()
    } catch (err) {
      alert(err.message || 'Send failed')
    }
    setSending(false)
  }

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4" style={{ minHeight: 480 }}>
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>Loading…</p>
        ) : conversations.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: '#666666' }}>No WhatsApp conversations yet.</p>
        ) : conversations.map((c) => (
          <button
            key={c.contact_phone}
            onClick={() => setSelected(c.contact_phone)}
            className="w-full text-left px-4 py-3 transition-colors"
            style={{ borderBottom: '1px solid #2A2A2A', background: selected === c.contact_phone ? 'rgba(200,169,110,0.08)' : 'transparent' }}
          >
            <span className="text-sm font-semibold block mb-1" style={{ color: '#fff' }}>{c.contact_phone}</span>
            <p className="text-xs truncate" style={{ color: '#666666' }}>{c.last_message}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl flex flex-col" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center"><p className="text-sm" style={{ color: '#666666' }}>Select a conversation.</p></div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ maxHeight: 420 }}>
              {messages.map((m) => (
                <div key={m.id} className="flex" style={{ justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                  <div className="max-w-[70%] px-4 py-2.5 rounded-xl text-sm" style={m.direction === 'outbound' ? { background: '#25D366', color: '#052a13' } : { background: '#1A1A1A', color: '#fff', border: '1px solid #2A2A2A' }}>
                    {m.message}
                    <p className="text-[10px] mt-1" style={{ opacity: 0.6 }}>{new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 flex gap-2" style={{ borderTop: '1px solid #2A2A2A' }}>
              <input style={inputStyle} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a WhatsApp reply…" onKeyDown={(e) => e.key === 'Enter' && sendReply()} />
              <button onClick={sendReply} disabled={sending} className="px-4 py-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold uppercase" style={{ background: '#25D366', color: '#052a13', opacity: sending ? 0.6 : 1 }}>
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CampaignsTab() {
  const [template, setTemplate] = useState('')
  const [rawNumbers, setRawNumbers] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const send = async () => {
    setError(''); setResult(null)
    const recipients = rawNumbers.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [phone, ...rest] = line.split(',').map((s) => s.trim())
      return { phone, name: rest[0] || '', business: rest[1] || '' }
    })
    if (!template.trim() || !recipients.length) { setError('Message template and at least one phone number are required.'); return }
    setRunning(true)
    try {
      const data = await SMSAPI.sendWhatsappCampaign({ campaign_name: 'WhatsApp Campaign', message_template: template, recipients })
      setResult(data)
    } catch (err) {
      setError(err.message || 'Campaign failed')
    }
    setRunning(false)
  }

  return (
    <div className="max-w-2xl rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: '#666666' }}>Message Template</label>
      <textarea style={{ ...inputStyle, minHeight: 80, marginBottom: 16 }} value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="Hola [name], following up about [business]…" />
      <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: '#666666' }}>
        <Upload className="w-3 h-3 inline mr-1" /> Phone Numbers — one per line: phone, name, business
      </label>
      <textarea style={{ ...inputStyle, minHeight: 100, marginBottom: 16, fontFamily: 'monospace' }} value={rawNumbers} onChange={(e) => setRawNumbers(e.target.value)} placeholder={'2035551234, Maria, La Paloma Restaurant'} />
      {error && <p className="text-xs mb-4" style={{ color: '#f87171' }}>{error}</p>}
      {result && <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid #25D36650', color: '#25D366' }}>Sent {result.total_sent} · Failed {result.total_failed}</div>}
      <button onClick={send} disabled={running} className="flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ background: '#25D366', color: '#052a13', opacity: running ? 0.6 : 1 }}>
        <Plus className="w-3.5 h-3.5" /> {running ? 'Sending…' : 'Send WhatsApp Campaign'}
      </button>
    </div>
  )
}

export default function WhatsAppHome() {
  const [tab, setTab] = useState('Conversations')
  return (
    <DashboardShell title="Nova WhatsApp">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}>
        <MessageCircle className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />
        Same AI conversation engine as Nova Blue, delivered over WhatsApp — critical for reaching Waterbury's Spanish-speaking community.
      </p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>{t}</button>)}
      </div>
      {tab === 'Conversations' && <ConversationsTab />}
      {tab === 'Campaigns' && <CampaignsTab />}
    </DashboardShell>
  )
}
