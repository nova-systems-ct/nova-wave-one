import { useEffect, useState } from 'react'
import { BookOpen, Link as LinkIcon, Upload, Eye } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { KnowledgeAPI, VoiceAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }
const areaStyle = { ...inputStyle, minHeight: 90, resize: 'vertical' }
const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#666666', marginBottom: 6 }

const SECTIONS = [
  { key: 'business_description', label: 'Business Info', placeholder: 'What the business does, who it serves…' },
  { key: 'services', label: 'Services & Pricing', placeholder: 'List services and prices…' },
  { key: 'hours', label: 'Hours', placeholder: 'Mon-Fri 9am-5pm…' },
  { key: 'address', label: 'Address', placeholder: '123 Main St, City, CT' },
  { key: 'booking_process', label: 'Booking Process', placeholder: 'How to book, step by step…' },
  { key: 'staff', label: 'Team / Staff', placeholder: 'Team members and roles…' },
  { key: 'policies', label: 'Policies', placeholder: 'Cancellation, refund, etc…' },
  { key: 'tone', label: 'Tone', placeholder: 'How this business likes to communicate…' },
  { key: 'never_say', label: 'Never Say', placeholder: 'Things the AI should never say…' },
  { key: 'always_say', label: 'Always Say', placeholder: 'Things the AI should always include…' },
  { key: 'competitors', label: 'Competitors', placeholder: 'Who they compete with and our edge…' },
]

export default function KnowledgeHome() {
  const [agents, setAgents] = useState([])
  const [agentId, setAgentId] = useState('')
  const [kb, setKb] = useState({})
  const [form, setForm] = useState({})
  const [faqs, setFaqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [preview, setPreview] = useState('')
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)

  useEffect(() => {
    VoiceAPI.getAgents().then((d) => {
      const rows = Array.isArray(d) ? d : []
      setAgents(rows)
      if (rows[0]) setAgentId(rows[0].id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!agentId) return
    KnowledgeAPI.getKnowledge(agentId).then((d) => {
      setKb(d || {})
      setForm(d || {})
      setFaqs(Array.isArray(d?.faqs) ? d.faqs : [])
    }).catch(() => {})
  }, [agentId])

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const saveSection = async (key) => {
    setSaving(key)
    try {
      await KnowledgeAPI.updateSection({ agent_id: agentId, [key]: form[key] })
      setKb((k) => ({ ...k, [key]: form[key] }))
    } catch (err) {
      alert(err.message || 'Save failed')
    }
    setSaving('')
  }

  const saveFaqs = async () => {
    setSaving('faqs')
    try {
      await KnowledgeAPI.updateSection({ agent_id: agentId, faqs })
    } catch (err) { alert(err.message || 'Save failed') }
    setSaving('')
  }

  const runScrape = async () => {
    if (!scrapeUrl.trim()) return
    setScraping(true)
    try {
      const data = await KnowledgeAPI.scrapeUrl({ url: scrapeUrl })
      set('business_description', (form.business_description || '') + (form.business_description ? '\n\n' : '') + (data.summary || data.raw_text || ''))
    } catch (err) {
      alert(err.message || 'Scrape failed')
    }
    setScraping(false)
  }

  const loadPreview = async () => {
    const data = await KnowledgeAPI.getSystemPrompt(agentId).catch(() => null)
    setPreview(data?.system_prompt || '')
  }

  return (
    <DashboardShell title="Nova Knowledge">
      <p className="text-sm mb-6 max-w-2xl" style={{ color: '#999999' }}>
        <BookOpen className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />
        Every engine reads from this before responding — SMS, email, voice, and social all use the same knowledge base per agent.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
      ) : agents.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-sm" style={{ color: '#666666' }}>No agents yet — create one first from the Agents page.</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label style={labelStyle}>Agent</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{ ...inputStyle, maxWidth: 360 }}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.agent_name} — {a.business_name}</option>)}
            </select>
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-5">
            <div className="space-y-5">
              {SECTIONS.map((s) => (
                <div key={s.key} className="rounded-xl p-5" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
                  <label style={labelStyle}>{s.label}</label>
                  <textarea style={areaStyle} placeholder={s.placeholder} value={form[s.key] || ''} onChange={(e) => set(s.key, e.target.value)} />
                  <button onClick={() => saveSection(s.key)} disabled={saving === s.key} className="mt-3 px-4 py-2 text-[11px] font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: saving === s.key ? 0.6 : 1 }}>
                    {saving === s.key ? 'Saving…' : 'Save Section'}
                  </button>
                </div>
              ))}

              <div className="rounded-xl p-5" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
                <label style={labelStyle}>FAQs</label>
                {faqs.map((f, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 mb-2">
                    <input style={inputStyle} placeholder="Question" value={f.q || ''} onChange={(e) => setFaqs((prev) => prev.map((x, idx) => idx === i ? { ...x, q: e.target.value } : x))} />
                    <input style={inputStyle} placeholder="Answer" value={f.a || ''} onChange={(e) => setFaqs((prev) => prev.map((x, idx) => idx === i ? { ...x, a: e.target.value } : x))} />
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setFaqs((prev) => [...prev, { q: '', a: '' }])} className="px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>+ Add FAQ</button>
                  <button onClick={saveFaqs} disabled={saving === 'faqs'} className="px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>{saving === 'faqs' ? 'Saving…' : 'Save FAQs'}</button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl p-5" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
                <label style={labelStyle}><LinkIcon className="w-3 h-3 inline mr-1" /> Scrape a URL</label>
                <input style={inputStyle} placeholder="https://clientwebsite.com" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} />
                <button onClick={runScrape} disabled={scraping} className="mt-3 w-full px-4 py-2 text-[11px] font-bold uppercase rounded-lg" style={{ border: `1px solid ${GOLD}`, color: GOLD, opacity: scraping ? 0.6 : 1 }}>
                  {scraping ? 'Fetching…' : 'Fetch & Summarize'}
                </button>
                <p className="text-[11px] mt-2" style={{ color: '#666666' }}>Appends the summary to Business Info — review before saving.</p>
              </div>

              <div className="rounded-xl p-5" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
                <label style={labelStyle}><Eye className="w-3 h-3 inline mr-1" /> System Prompt Preview</label>
                <button onClick={loadPreview} className="w-full px-4 py-2 text-[11px] font-bold uppercase rounded-lg mb-3" style={{ border: '1px solid #2A2A2A', color: '#fff' }}>Generate Preview</button>
                {preview && <pre className="text-[11px] whitespace-pre-wrap p-3 rounded-lg" style={{ background: '#080808', color: '#999999', maxHeight: 400, overflowY: 'auto' }}>{preview}</pre>}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  )
}
