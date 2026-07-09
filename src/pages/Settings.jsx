import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import { api } from '../lib/api'

const GOLD = '#C8A96E'
const FIELDS = [
  { key: 'GOOGLE_API_KEY', label: 'Google API Key (Places + PageSpeed)' },
  { key: 'TWILIO_ACCOUNT_SID', label: 'Twilio Account SID' },
  { key: 'TWILIO_AUTH_TOKEN', label: 'Twilio Auth Token' },
  { key: 'TWILIO_PHONE_NUMBER', label: 'Twilio Phone Number' },
  { key: 'ELEVENLABS_API_KEY', label: 'ElevenLabs API Key' },
  { key: 'DEEPGRAM_API_KEY', label: 'Deepgram API Key' },
]

export default function Settings() {
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/auth', { action: 'get_settings' }).then((d) => setValues(d || {})).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try { await api.post('/api/auth?action=set_settings', values) } catch {}
    setSaving(false)
  }

  const inputStyle = { width: '100%', padding: '11px 14px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'monospace' }

  return (
    <DashboardShell title="Settings">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}>API keys used by the backend engines. Stored server-side, never exposed to the browser.</p>
      {loading ? (
        <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
      ) : (
        <div className="rounded-xl p-8 max-w-lg" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          {FIELDS.map((f) => (
            <div key={f.key} className="mb-4">
              <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: '#666666' }}>{f.label}</label>
              <input type="password" style={inputStyle} value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder="Not set" />
            </div>
          ))}
          <button onClick={save} disabled={saving} className="mt-2 px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] rounded-lg" style={{ background: GOLD, color: '#080808', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </DashboardShell>
  )
}
