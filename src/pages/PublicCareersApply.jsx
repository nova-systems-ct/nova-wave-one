import { useState } from 'react'
import NovaLogo from '../components/NovaLogo'
import { HireAPI } from '../lib/api'

const GOLD = '#C8A96E'
const inputStyle = { width: '100%', padding: '12px 14px', background: '#0E0E0E', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' }

export default function PublicCareersApply() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: 'account_executive', cover_letter: '', portfolio_url: '' })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await HireAPI.submitApplication(form)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Submission failed')
    }
    setSending(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#080808' }}>
        <div className="text-center max-w-sm">
          <NovaLogo size={36} />
          <h1 className="text-xl font-bold text-white mt-6 mb-2">Application received.</h1>
          <p className="text-sm" style={{ color: '#999999' }}>Thank you for applying to Nova Systems — we'll be in touch.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: '#080808' }}>
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <NovaLogo size={36} />
          <p className="mt-3 text-xs font-bold tracking-[0.3em] uppercase" style={{ color: GOLD }}>JOIN NOVA SYSTEMS</p>
        </div>
        <form onSubmit={submit} className="rounded-xl p-8 space-y-4" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <select style={inputStyle} value={form.position} onChange={(e) => set('position', e.target.value)}>
            <option value="account_executive">Account Executive</option>
            <option value="content_creator">Content Creator</option>
          </select>
          <input required style={inputStyle} placeholder="Full name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <input required type="email" style={inputStyle} placeholder="Email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <input style={inputStyle} placeholder="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <input style={inputStyle} placeholder="Portfolio link (optional)" value={form.portfolio_url} onChange={(e) => set('portfolio_url', e.target.value)} />
          <textarea style={{ ...inputStyle, minHeight: 120 }} placeholder="Cover letter" value={form.cover_letter} onChange={(e) => set('cover_letter', e.target.value)} />
          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          <button type="submit" disabled={sending} className="w-full py-3.5 text-xs font-bold tracking-[0.2em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: sending ? 0.6 : 1 }}>
            {sending ? 'Submitting…' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}
