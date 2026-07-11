import { useEffect, useState } from 'react'
import { Share2, Instagram, Facebook, MessageCircle } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { SocialAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Activity Feed', 'Setup']

const PLATFORM_ICON = { instagram: Instagram, facebook: Facebook }
const PLATFORM_COLOR = { instagram: '#e1306c', facebook: '#1877f2' }

function ActivityFeedTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => SocialAPI.getLogs({ limit: 100 }).then((d) => setLogs(Array.isArray(d) ? d : [])).catch(() => setLogs([])).finally(() => setLoading(false))

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <p className="text-sm" style={{ color: '#666666' }}>Loading…</p>
  if (logs.length === 0) {
    return (
      <div className="rounded-xl py-16 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <Share2 className="w-8 h-8 mx-auto mb-4" style={{ color: '#2A2A2A' }} />
        <p className="text-sm" style={{ color: '#666666' }}>No DMs or comments yet. Connect an Instagram/Facebook account in the Setup tab.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      {logs.map((l, i) => {
        const Icon = PLATFORM_ICON[l.platform] || MessageCircle
        const color = PLATFORM_COLOR[l.platform] || GOLD
        return (
          <div key={l.id} className="flex items-start gap-3 px-5 py-4" style={{ borderBottom: i < logs.length - 1 ? '1px solid #2A2A2A' : 'none' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold" style={{ color: '#fff' }}>{l.from_user || 'unknown'}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: `${GOLD}18`, color: GOLD }}>{l.event_type}</span>
              </div>
              <p className="text-xs mb-1.5" style={{ color: '#999999' }}>{l.message}</p>
              {l.ai_reply && <p className="text-xs" style={{ color: '#666666' }}><span style={{ color: GOLD }}>AI replied:</span> {l.ai_reply}</p>}
            </div>
            <span className="text-[11px] flex-shrink-0" style={{ color: '#666666' }}>{new Date(l.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        )
      })}
    </div>
  )
}

function SetupTab() {
  const [status, setStatus] = useState(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nova-wave-one.vercel.app'
  const webhookUrl = `${origin}/api/nova-social?action=receive_webhook`

  useEffect(() => {
    SocialAPI.setupStatus().then(setStatus).catch(() => setStatus({ metaAccessTokenConfigured: false, webhookVerifyToken: null }))
  }, [])

  const row = (label, value, mono = true) => (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: '#666666' }}>{label}</p>
      <code className="block text-xs px-3 py-2.5 rounded-lg break-all" style={{ background: '#080808', border: '1px solid #2A2A2A', color: '#ccc', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</code>
    </div>
  )

  return (
    <div className="max-w-2xl rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <p className="text-xs font-bold tracking-[0.15em] uppercase mb-5" style={{ color: GOLD }}>Meta Webhook Setup</p>

      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: status == null ? '#666666' : status.metaAccessTokenConfigured ? '#4ade80' : '#f87171' }} />
        <span className="text-sm font-semibold" style={{ color: '#fff' }}>
          META_ACCESS_TOKEN {status == null ? 'checking…' : status.metaAccessTokenConfigured ? 'configured' : 'not configured'}
        </span>
      </div>

      {row('Callback URL (Instagram + Facebook)', webhookUrl)}
      {row('Verify Token', status?.webhookVerifyToken || '(set META_WEBHOOK_VERIFY_TOKEN)')}
      {row('Subscriptions', 'messages, messaging_postbacks, comments', false)}

      <div className="text-xs space-y-2" style={{ color: '#999999' }}>
        <p>1. Go to Meta for Developers → your app → Webhooks.</p>
        <p>2. Add the callback URL and verify token above, subscribe to the fields listed.</p>
        <p>3. Meta sends one GET request to verify the subscription, then POSTs every DM and comment event to the same URL.</p>
        <p>4. Every reply is generated by Claude using the connected agent's knowledge base and sent back via the Meta Graph API — nothing is canned.</p>
      </div>
    </div>
  )
}

export default function SocialHome() {
  const [tab, setTab] = useState('Activity Feed')
  return (
    <DashboardShell title="Nova Social">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}>
        <Share2 className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />
        AI replying to every Instagram and Facebook DM and comment, with automatic comment-to-DM follow-up.
      </p>
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{
            letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent',
          }}>{t}</button>
        ))}
      </div>
      {tab === 'Activity Feed' && <ActivityFeedTab />}
      {tab === 'Setup' && <SetupTab />}
    </DashboardShell>
  )
}
