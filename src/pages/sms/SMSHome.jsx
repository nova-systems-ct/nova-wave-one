import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, RefreshCcw, Plus, Upload } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { SMSAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Conversations', 'Campaigns', 'Cold Leads']

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
  const pollRef = useRef(null)

  const loadConversations = () => {
    SMSAPI.getConversations().then((data) => setConversations(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadConversations()
    pollRef.current = setInterval(loadConversations, 10000)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (!selected) return
    const load = () => SMSAPI.getConversation(selected).then((data) => setMessages(Array.isArray(data) ? data : [])).catch(() => {})
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [selected])

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      await SMSAPI.send({ to: selected, message: reply })
      setReply('')
      const data = await SMSAPI.getConversation(selected)
      setMessages(Array.isArray(data) ? data : [])
      loadConversations()
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
          <p className="p-6 text-sm" style={{ color: '#666666' }}>No SMS conversations yet.</p>
        ) : conversations.map((c) => (
          <button
            key={c.contact_phone}
            onClick={() => setSelected(c.contact_phone)}
            className="w-full text-left px-4 py-3 transition-colors"
            style={{ borderBottom: '1px solid #2A2A2A', background: selected === c.contact_phone ? 'rgba(200,169,110,0.08)' : 'transparent' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold" style={{ color: '#fff' }}>{c.contact_phone}</span>
              {c.unread > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: GOLD, color: '#080808' }}>{c.unread}</span>}
            </div>
            <p className="text-xs truncate" style={{ color: '#666666' }}>{c.last_message}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl flex flex-col" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: '#666666' }}>Select a conversation.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ maxHeight: 420 }}>
              {messages.map((m) => (
                <div key={m.id} className="flex" style={{ justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                  <div
                    className="max-w-[70%] px-4 py-2.5 rounded-xl text-sm"
                    style={m.direction === 'outbound'
                      ? { background: GOLD, color: '#080808', borderBottomRightRadius: 4 }
                      : { background: '#1A1A1A', color: '#fff', borderBottomLeftRadius: 4, border: '1px solid #2A2A2A' }}
                  >
                    {m.message}
                    <p className="text-[10px] mt-1" style={{ opacity: 0.6 }}>{new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 flex gap-2" style={{ borderTop: '1px solid #2A2A2A' }}>
              <input style={inputStyle} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" onKeyDown={(e) => e.key === 'Enter' && sendReply()} />
              <button onClick={sendReply} disabled={sending} className="px-4 py-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold uppercase" style={{ background: GOLD, color: '#080808', opacity: sending ? 0.6 : 1 }}>
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
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('')
  const [rawNumbers, setRawNumbers] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const insertToken = (token) => setTemplate((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${token}`)

  const parseRecipients = () => rawNumbers.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [phone, ...rest] = line.split(',').map((s) => s.trim())
    return { phone, name: rest[0] || '', business: rest[1] || '' }
  })

  const send = async () => {
    setError(''); setResult(null)
    const recipients = parseRecipients()
    if (!template.trim() || !recipients.length) { setError('Message template and at least one phone number are required.'); return }
    setRunning(true)
    try {
      const data = await SMSAPI.sendCampaign({ campaign_name: name || 'Untitled Campaign', message_template: template, recipients })
      setResult(data)
    } catch (err) {
      setError(err.message || 'Campaign failed')
    }
    setRunning(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: '#666666' }}>Campaign Name</label>
        <input style={{ ...inputStyle, marginBottom: 16 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Follow-Up" />

        <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: '#666666' }}>Message Template</label>
        <div className="flex gap-2 mb-2">
          <button onClick={() => insertToken('[name]')} className="text-[10px] font-bold px-2 py-1 rounded" style={{ border: `1px solid ${GOLD}50`, color: GOLD }}>+ [name]</button>
          <button onClick={() => insertToken('[business]')} className="text-[10px] font-bold px-2 py-1 rounded" style={{ border: `1px solid ${GOLD}50`, color: GOLD }}>+ [business]</button>
        </div>
        <textarea style={{ ...inputStyle, minHeight: 80, marginBottom: 16 }} value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="Hey [name], following up about [business]…" />

        <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: '#666666' }}>
          <Upload className="w-3 h-3 inline mr-1" /> Phone Numbers — one per line: phone, name, business
        </label>
        <textarea style={{ ...inputStyle, minHeight: 100, marginBottom: 16, fontFamily: 'monospace' }} value={rawNumbers} onChange={(e) => setRawNumbers(e.target.value)} placeholder={'2035551234, Maria, La Paloma Restaurant\n8605559876, John'} />

        {error && <p className="text-xs mb-4" style={{ color: '#f87171' }}>{error}</p>}
        {result && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(200,169,110,0.08)', border: `1px solid ${GOLD}40`, color: GOLD }}>
            Sent {result.total_sent} · Failed {result.total_failed}
          </div>
        )}

        <button onClick={send} disabled={running} className="flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: running ? 0.6 : 1 }}>
          <Plus className="w-3.5 h-3.5" /> {running ? 'Sending…' : 'Send Campaign'}
        </button>
      </div>
    </div>
  )
}

function ColdLeadsTab() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const check = async () => {
    setRunning(true); setError(''); setResult(null)
    try {
      const data = await SMSAPI.checkColdLeads()
      setResult(data)
    } catch (err) {
      setError(err.message || 'Failed')
    }
    setRunning(false)
  }

  return (
    <div className="max-w-xl rounded-xl p-8 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <RefreshCcw className="w-8 h-8 mx-auto mb-4" style={{ color: GOLD }} />
      <p className="text-sm mb-6" style={{ color: '#999999' }}>Finds every conversation where the last message was outbound more than 6 hours ago with no reply, and sends a real follow-up text.</p>
      <button onClick={check} disabled={running} className="px-6 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: running ? 0.6 : 1 }}>
        {running ? 'Checking…' : 'Check Cold Leads'}
      </button>
      {error && <p className="text-xs mt-4" style={{ color: '#f87171' }}>{error}</p>}
      {result && <p className="text-sm mt-4" style={{ color: GOLD }}>Sent {result.followed_up} follow-up{result.followed_up === 1 ? '' : 's'}.</p>}
    </div>
  )
}

export default function SMSHome() {
  const [tab, setTab] = useState('Conversations')
  return (
    <DashboardShell title="Nova Blue — SMS">
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>{t}</button>)}
      </div>
      {tab === 'Conversations' && <ConversationsTab />}
      {tab === 'Campaigns' && <CampaignsTab />}
      {tab === 'Cold Leads' && <ColdLeadsTab />}
    </DashboardShell>
  )
}
