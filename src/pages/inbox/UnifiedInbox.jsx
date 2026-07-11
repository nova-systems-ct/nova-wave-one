import { useEffect, useRef, useState } from 'react'
import { Inbox, Phone, MessageSquare, MessageCircle, Mail, Share2, Send } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { SMSAPI, EmailAPI, VoiceAPI, SocialAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const FILTERS = ['All', 'Phone', 'SMS', 'WhatsApp', 'Email', 'Social']

const CHANNEL_META = {
  voice: { icon: Phone, color: '#a78bfa', label: 'Phone' },
  sms: { icon: MessageSquare, color: '#60a5fa', label: 'SMS' },
  whatsapp: { icon: MessageCircle, color: '#25D366', label: 'WhatsApp' },
  email: { icon: Mail, color: '#2dd4bf', label: 'Email' },
  social: { icon: Share2, color: GOLD, label: 'Social' },
}

const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

async function loadAllThreads() {
  const [smsConvos, emails, calls, social] = await Promise.all([
    SMSAPI.getConversations().catch(() => []),
    EmailAPI.list({ limit: 100 }).catch(() => []),
    VoiceAPI.getCalls({ limit: 100 }).catch(() => []),
    SocialAPI.getLogs({ limit: 100 }).catch(() => []),
  ])

  const threads = []

  for (const c of Array.isArray(smsConvos) ? smsConvos : []) {
    threads.push({
      id: `${c.platform || 'sms'}-${c.contact_phone}`, channel: c.platform === 'whatsapp' ? 'whatsapp' : 'sms',
      contact: c.contact_phone, preview: c.last_message, ts: c.last_message_time, unread: c.unread || 0,
    })
  }

  const emailByContact = {}
  for (const e of Array.isArray(emails) ? emails : []) {
    const contact = e.direction === 'inbound' ? e.from_email : e.to_email
    if (!contact) continue
    if (!emailByContact[contact] || new Date(e.created_at) > new Date(emailByContact[contact].ts)) {
      emailByContact[contact] = { id: `email-${contact}`, channel: 'email', contact, preview: e.subject, ts: e.created_at, unread: e.needs_review ? 1 : 0 }
    }
  }
  threads.push(...Object.values(emailByContact))

  for (const c of Array.isArray(calls) ? calls : []) {
    threads.push({ id: `voice-${c.id}`, channel: 'voice', contact: c.caller_phone, preview: `Call ${c.outcome || 'logged'} (${c.duration || 0}s)`, ts: c.created_at, unread: 0, raw: c })
  }

  for (const s of Array.isArray(social) ? social : []) {
    threads.push({ id: `social-${s.id}`, channel: 'social', contact: s.from_user, preview: s.message, ts: s.created_at, unread: 0, raw: s })
  }

  threads.sort((a, b) => new Date(b.ts) - new Date(a.ts))
  return threads
}

export default function UnifiedInbox() {
  const [threads, setThreads] = useState([])
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const load = () => loadAllThreads().then(setThreads).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 20000)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (!selected) { setMessages([]); return }
    const loadThread = async () => {
      if (selected.channel === 'sms' || selected.channel === 'whatsapp') {
        const data = await SMSAPI.getConversation(selected.contact).catch(() => [])
        setMessages((Array.isArray(data) ? data : []).filter((m) => (selected.channel === 'whatsapp') === (m.platform === 'whatsapp')))
      } else if (selected.channel === 'email') {
        const data = await EmailAPI.list({ limit: 200 }).catch(() => [])
        setMessages((Array.isArray(data) ? data : []).filter((e) => e.from_email === selected.contact || e.to_email === selected.contact))
      } else if (selected.channel === 'voice') {
        setMessages([selected.raw])
      } else if (selected.channel === 'social') {
        setMessages([selected.raw])
      }
    }
    loadThread()
    const id = setInterval(loadThread, 20000)
    return () => clearInterval(id)
  }, [selected])

  const filtered = threads.filter((t) => {
    if (filter === 'All') return true
    if (filter === 'Phone') return t.channel === 'voice'
    return CHANNEL_META[t.channel]?.label === filter
  })

  const canReply = selected && ['sms', 'whatsapp', 'email'].includes(selected.channel)

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      if (selected.channel === 'sms') await SMSAPI.send({ to: selected.contact, message: reply })
      else if (selected.channel === 'whatsapp') await SMSAPI.sendWhatsapp({ to: selected.contact, message: reply })
      else if (selected.channel === 'email') await EmailAPI.send({ to: selected.contact, subject: 'Re: Nova Systems', body_html: `<p>${reply.replace(/\n/g, '</p><p>')}</p>` })
      setReply('')
      load()
    } catch (err) {
      alert(err.message || 'Send failed')
    }
    setSending(false)
  }

  return (
    <DashboardShell title="Unified Inbox">
      <div className="flex items-center gap-2 mb-5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="px-4 py-2 text-[11px] font-bold uppercase rounded-lg" style={{
            letterSpacing: '0.06em', border: `1px solid ${filter === f ? GOLD : '#2A2A2A'}`, color: filter === f ? '#080808' : '#999999', background: filter === f ? GOLD : 'transparent',
          }}>{f}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-[340px_1fr] gap-4" style={{ minHeight: 520 }}>
        <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A', maxHeight: 620, overflowY: 'auto' }}>
          {loading ? (
            <p className="p-6 text-sm" style={{ color: '#666666' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox className="w-8 h-8 mx-auto mb-4" style={{ color: '#2A2A2A' }} />
              <p className="text-sm" style={{ color: '#666666' }}>No conversations yet.</p>
            </div>
          ) : filtered.map((t) => {
            const meta = CHANNEL_META[t.channel] || CHANNEL_META.sms
            const Icon = meta.icon
            return (
              <button key={t.id} onClick={() => setSelected(t)} className="w-full text-left flex items-start gap-3 px-4 py-3" style={{ borderBottom: '1px solid #2A2A2A', background: selected?.id === t.id ? 'rgba(200,169,110,0.08)' : 'transparent' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}40` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold truncate" style={{ color: '#fff' }}>{t.contact || 'unknown'}</span>
                    {t.unread > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: GOLD, color: '#080808' }}>{t.unread}</span>}
                  </div>
                  <p className="text-xs truncate" style={{ color: '#666666' }}>{t.preview}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl flex flex-col" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center"><p className="text-sm" style={{ color: '#666666' }}>Select a conversation.</p></div>
          ) : (
            <>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2A2A2A' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#fff' }}>{selected.contact}</p>
                  <p className="text-[11px]" style={{ color: '#666666' }}>{(CHANNEL_META[selected.channel] || {}).label}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ maxHeight: 420 }}>
                {selected.channel === 'sms' || selected.channel === 'whatsapp' ? (
                  messages.map((m) => (
                    <div key={m.id} className="flex" style={{ justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                      <div className="max-w-[70%] px-4 py-2.5 rounded-xl text-sm" style={m.direction === 'outbound' ? { background: GOLD, color: '#080808' } : { background: '#1A1A1A', color: '#fff', border: '1px solid #2A2A2A' }}>
                        {m.message}
                        <p className="text-[10px] mt-1" style={{ opacity: 0.6 }}>{new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))
                ) : selected.channel === 'email' ? (
                  messages.map((e) => (
                    <div key={e.id} className="p-4 rounded-lg" style={{ background: '#080808', border: '1px solid #2A2A2A' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#fff' }}>{e.subject}</p>
                      <p className="text-xs whitespace-pre-wrap" style={{ color: '#999999' }}>{e.body?.replace(/<[^>]+>/g, ' ').slice(0, 500) || e.ai_draft}</p>
                    </div>
                  ))
                ) : selected.channel === 'voice' ? (
                  <div className="p-4 rounded-lg" style={{ background: '#080808', border: '1px solid #2A2A2A' }}>
                    <p className="text-xs whitespace-pre-wrap" style={{ color: '#ccc' }}>{selected.raw?.transcript || 'No transcript available.'}</p>
                  </div>
                ) : selected.channel === 'social' ? (
                  <div className="p-4 rounded-lg" style={{ background: '#080808', border: '1px solid #2A2A2A' }}>
                    <p className="text-xs mb-2" style={{ color: '#999999' }}>{selected.raw?.message}</p>
                    {selected.raw?.ai_reply && <p className="text-xs" style={{ color: GOLD }}>AI replied: {selected.raw.ai_reply}</p>}
                  </div>
                ) : null}
              </div>

              <div className="p-4 flex gap-2" style={{ borderTop: '1px solid #2A2A2A' }}>
                {canReply ? (
                  <>
                    <input style={inputStyle} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" onKeyDown={(e) => e.key === 'Enter' && sendReply()} />
                    <button onClick={sendReply} disabled={sending} className="px-4 py-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold uppercase" style={{ background: GOLD, color: '#080808', opacity: sending ? 0.6 : 1 }}>
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </>
                ) : (
                  <p className="text-xs" style={{ color: '#666666' }}>Replies for this channel happen from its own engine page.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
