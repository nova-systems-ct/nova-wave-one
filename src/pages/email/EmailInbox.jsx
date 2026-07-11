import { useEffect, useState } from 'react'
import { Mail, Send, Edit3, X } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { EmailAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['All', 'Needs Review', 'Auto-Responded', 'Leads', 'Clients']
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

export default function EmailInbox() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    EmailAPI.list().then((data) => {
      const rows = Array.isArray(data) ? data : []
      setEmails(rows)
      setSelected(rows[0] || null)
    }).catch(() => setEmails([])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setDraft(selected?.ai_draft || '')
    setEditing(false)
    setError('')
  }, [selected])

  const filtered = emails.filter((e) => {
    if (tab === 'All') return true
    if (tab === 'Needs Review') return e.status === 'needs_review' || !e.status
    if (tab === 'Auto-Responded') return e.status === 'auto_responded'
    if (tab === 'Leads') return e.category === 'Lead'
    if (tab === 'Clients') return e.category === 'Client'
    return true
  })

  const sendDraft = async (text) => {
    if (!selected?.from_email || !text?.trim()) { setError('No reply address or draft content to send.'); return }
    setSending(true); setError('')
    try {
      await EmailAPI.approveSend({ id: selected.id, to: selected.from_email, subject: `Re: ${selected.subject || ''}`, html: `<p>${text.replace(/\n/g, '</p><p>')}</p>` })
      setEmails((prev) => prev.map((e) => e.id === selected.id ? { ...e, sent: true, needs_review: false, status: 'auto_responded' } : e))
      setSelected((s) => s ? { ...s, sent: true, needs_review: false, status: 'auto_responded' } : s)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Send failed')
    }
    setSending(false)
  }

  const dismiss = async () => {
    if (!selected) return
    await EmailAPI.updateStatus({ id: selected.id, status: 'ignored' }).catch(() => {})
    setEmails((prev) => prev.map((e) => e.id === selected.id ? { ...e, status: 'ignored' } : e))
    setSelected((s) => s ? { ...s, status: 'ignored' } : s)
  }

  return (
    <DashboardShell title="Email Inbox">
      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] rounded-lg"
            style={{ background: tab === t ? GOLD : 'transparent', color: tab === t ? '#080808' : '#999999', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}` }}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-5">
        <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A', maxHeight: 560, overflowY: 'auto' }}>
          {loading ? (
            <p className="p-6 text-sm" style={{ color: '#666666' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-7 h-7 mx-auto mb-3" style={{ color: '#2A2A2A' }} />
              <p className="text-sm" style={{ color: '#666666' }}>No emails here yet.</p>
            </div>
          ) : filtered.map((e) => (
            <button key={e.id} onClick={() => setSelected(e)} className="w-full text-left px-5 py-4" style={{ borderBottom: '1px solid #2A2A2A', background: selected?.id === e.id ? 'rgba(200,169,110,0.06)' : 'transparent' }}>
              <p className="text-sm truncate" style={{ color: '#fff' }}>{e.from_email}</p>
              <p className="text-xs truncate mt-0.5" style={{ color: '#666666' }}>{e.subject}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A', minHeight: 400 }}>
          {!selected ? (
            <p className="text-sm" style={{ color: '#666666' }}>Select an email to view the thread.</p>
          ) : (
            <>
              <p className="text-lg font-bold text-white mb-1">{selected.subject}</p>
              <p className="text-xs mb-6" style={{ color: '#666666' }}>From {selected.from_email}</p>
              <p className="text-sm mb-8 whitespace-pre-wrap" style={{ color: '#ccc' }}>{selected.body || 'No body content.'}</p>

              {selected.ai_draft && (
                <div className="rounded-lg p-5 mb-5" style={{ background: '#080808', border: `1px solid ${GOLD}40` }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: GOLD }}>AI Draft Response</p>
                  {editing ? (
                    <textarea rows={5} style={{ ...inputStyle, resize: 'vertical' }} value={draft} onChange={(e) => setDraft(e.target.value)} />
                  ) : (
                    <p className="text-sm" style={{ color: '#ccc' }}>{selected.ai_draft}</p>
                  )}
                </div>
              )}

              {error && <p className="text-xs mb-4" style={{ color: '#f87171' }}>{error}</p>}
              {selected.sent && <p className="text-xs mb-4" style={{ color: '#4ade80' }}>Sent.</p>}

              <div className="flex gap-3">
                {editing ? (
                  <button onClick={() => sendDraft(draft)} disabled={sending} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: sending ? 0.6 : 1 }}>
                    <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send Edited Reply'}
                  </button>
                ) : (
                  <button onClick={() => sendDraft(selected.ai_draft)} disabled={sending || !selected.ai_draft} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: sending || !selected.ai_draft ? 0.6 : 1 }}>
                    <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send Now'}
                  </button>
                )}
                <button onClick={() => setEditing((v) => !v)} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>
                  <Edit3 className="w-3.5 h-3.5" /> {editing ? 'Cancel Edit' : 'Edit and Send'}
                </button>
                <button onClick={dismiss} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#999999' }}>
                  <X className="w-3.5 h-3.5" /> Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
