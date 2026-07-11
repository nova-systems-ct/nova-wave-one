import { useState } from 'react'
import { Send } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { EmailAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TOKENS = ['[name]', '[business_name]', '[city]', '[industry]', '[score]', '[monthly_leak]', '[competitor_name]']

const inputStyle = { width: '100%', padding: '11px 14px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }
const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666666', marginBottom: 7 }

export default function EmailCampaigns() {
  const [campaignName, setCampaignName] = useState('')
  const [subject, setSubject] = useState('Quick question about [business_name]')
  const [body, setBody] = useState('Hi [name], I came across [business_name] and had a quick question about your services and pricing.')
  const [sequenceDay, setSequenceDay] = useState(1)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const insertToken = (token) => setBody((b) => `${b}${b && !b.endsWith(' ') ? ' ' : ''}${token}`)

  const send = async () => {
    setSending(true)
    setResult('')
    setError('')
    try {
      // recipient_list is intentionally omitted — the backend pulls real pending leads with an
      // email on file straight from the Nova Audit pipeline (nova_ai_audits) when it's not provided.
      const data = await EmailAPI.sendCampaign({
        campaign_name: campaignName || 'Untitled Campaign',
        subject_template: subject,
        body_html_template: `<p>${body.replace(/\n/g, '</p><p>')}</p>`,
        sequence_day: sequenceDay,
      })
      setResult(`Sent ${data.total_sent} · Failed ${data.total_failed}`)
    } catch (err) {
      setError(err.message || 'Failed to send campaign.')
    }
    setSending(false)
  }

  return (
    <DashboardShell title="Email Campaigns">
      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold tracking-[0.15em] uppercase mb-5" style={{ color: GOLD }}>Campaign Builder</p>

          <div className="mb-4">
            <label style={labelStyle}>Campaign Name</label>
            <input style={inputStyle} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Spring Audit Follow-Up" />
          </div>
          <div className="mb-4">
            <label style={labelStyle}>Subject Line</label>
            <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="mb-4">
            <label style={labelStyle}>Email Body</label>
            <textarea rows={8} style={{ ...inputStyle, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="mb-6">
            <label style={labelStyle}>Send Source</label>
            <p className="text-xs" style={{ color: '#999999' }}>Leads with an email on file from the Nova Audit pipeline (nova_ai_audits, became_client = false, opted_out = false).</p>
          </div>

          <div className="mb-6">
            <label style={labelStyle}>Sequence Day</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 3, 7, 14].map((d) => (
                <button key={d} onClick={() => setSequenceDay(d)} className="px-4 py-2 text-xs font-bold uppercase rounded-lg"
                  style={{ background: sequenceDay === d ? GOLD : 'transparent', color: sequenceDay === d ? '#080808' : '#999999', border: `1px solid ${sequenceDay === d ? GOLD : '#2A2A2A'}` }}>
                  Day {d}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs mb-4" style={{ color: '#f87171' }}>{error}</p>}
          {result && <p className="text-xs mb-4" style={{ color: GOLD }}>{result}</p>}

          <button onClick={send} disabled={sending} className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] rounded-lg" style={{ background: GOLD, color: '#080808', opacity: sending ? 0.6 : 1 }}>
            <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send Campaign'}
          </button>
        </div>

        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Personalization Tokens</p>
          <div className="flex flex-col gap-2">
            {TOKENS.map((t) => (
              <button key={t} onClick={() => insertToken(t)} className="text-xs px-3 py-2 rounded-lg text-left" style={{ background: '#080808', border: '1px solid #2A2A2A', color: '#ccc', fontFamily: 'monospace' }}>{t}</button>
            ))}
          </div>
          <p className="text-[11px] mt-4" style={{ color: '#666666' }}>Unsubscribe handling is applied automatically to every send.</p>
        </div>
      </div>
    </DashboardShell>
  )
}
