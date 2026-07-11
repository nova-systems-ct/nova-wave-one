import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import { AuthAPI } from '../lib/api'

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
  // configured: { KEY: true/false } — never the actual secret value. The API never returns
  // key values, so there is nothing here for the browser to leak.
  const [configured, setConfigured] = useState({})
  // edits: only what Isaac has typed in *this* session, to be sent on Save. Left untouched
  // (blank), a field changes nothing — it does not clear or resend the existing value.
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    AuthAPI.getSettings().then((d) => setConfigured(d || {})).catch((err) => setError(err.message || 'Failed to load settings')).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const changed = Object.fromEntries(Object.entries(edits).filter(([, v]) => v.trim().length > 0))
      if (!Object.keys(changed).length) { setError('Enter a new value in at least one field to save.'); setSaving(false); return }
      const data = await AuthAPI.setSettings(changed)
      setConfigured((prev) => { const next = { ...prev }; for (const k of data.updated || []) next[k] = true; return next })
      setEdits({})
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Failed to save settings')
    }
    setSaving(false)
  }

  const inputStyle = { width: '100%', padding: '11px 14px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'monospace' }

  return (
    <DashboardShell title="Settings">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}>
        API keys used by the backend engines. Values are stored server-side and are never sent back to the browser — this page only shows whether each one is currently configured. Type a new value to replace it.
      </p>
      {loading ? (
        <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
      ) : (
        <div className="rounded-xl p-8 max-w-lg" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          {FIELDS.map((f) => (
            <div key={f.key} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: '#666666' }}>{f.label}</label>
                <span className="text-[10px] font-bold uppercase" style={{ color: configured[f.key] ? '#4ade80' : '#f87171' }}>
                  {configured[f.key] ? 'Configured' : 'Not set'}
                </span>
              </div>
              <input
                type="password"
                autoComplete="new-password"
                style={inputStyle}
                value={edits[f.key] || ''}
                onChange={(e) => setEdits({ ...edits, [f.key]: e.target.value })}
                placeholder={configured[f.key] ? '•••••••••••• (leave blank to keep)' : 'Not set — enter a value'}
              />
            </div>
          ))}
          {error && <p className="text-xs mb-3" style={{ color: '#f87171' }}>{error}</p>}
          {saved && <p className="text-xs mb-3" style={{ color: '#4ade80' }}>Saved.</p>}
          <button onClick={save} disabled={saving} className="mt-2 px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] rounded-lg" style={{ background: GOLD, color: '#080808', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </DashboardShell>
  )
}
