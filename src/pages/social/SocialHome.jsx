import { useEffect, useState } from 'react'
import { Share2, Instagram, Facebook, MessageCircle, CalendarClock, Send } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { SocialAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Activity Feed', 'Schedule', 'Setup']

const PLATFORM_ICON = { instagram: Instagram, facebook: Facebook }
const PLATFORM_COLOR = { instagram: '#e1306c', facebook: '#1877f2' }
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }

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

const STATUS_COLOR = { scheduled: GOLD, published: '#4ade80', failed: '#f87171' }

function ScheduleTab() {
  const [posts, setPosts] = useState([])
  const [platform, setPlatform] = useState('instagram')
  const [content, setContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => SocialAPI.getScheduled().then((d) => setPosts(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const schedule = async () => {
    if (!content.trim() || !scheduledAt) return
    setSaving(true)
    try { await SocialAPI.schedulePost({ platform, content, scheduled_at: new Date(scheduledAt).toISOString() }); setContent(''); load() } catch (err) { alert(err.message) }
    setSaving(false)
  }

  const publishNow = async (id) => {
    await SocialAPI.publishPost({ id }).catch((err) => alert(err.message))
    load()
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-5">
      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: GOLD }}>Schedule a Post</p>
        <select style={{ ...inputStyle, marginBottom: 10 }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {['instagram', 'facebook', 'linkedin', 'tiktok'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <textarea style={{ ...inputStyle, minHeight: 90, marginBottom: 10 }} placeholder="Post content…" value={content} onChange={(e) => setContent(e.target.value)} />
        <input type="datetime-local" style={{ ...inputStyle, marginBottom: 12 }} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <button onClick={schedule} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}><CalendarClock className="w-3.5 h-3.5" /> {saving ? 'Scheduling…' : 'Schedule Post'}</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase px-6 py-4" style={{ color: GOLD, borderBottom: '1px solid #2A2A2A' }}>Queue</p>
        {posts.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>Nothing scheduled yet.</p> : posts.map((p) => (
          <div key={p.id} className="px-6 py-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase" style={{ color: GOLD }}>{p.platform}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: `${STATUS_COLOR[p.status]}18`, color: STATUS_COLOR[p.status] }}>{p.status}</span>
            </div>
            <p className="text-sm mt-1 truncate" style={{ color: '#ccc' }}>{p.content}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px]" style={{ color: '#666666' }}>{new Date(p.scheduled_at).toLocaleString()}</span>
              {p.status === 'scheduled' && <button onClick={() => publishNow(p.id)} className="flex items-center gap-1 text-[11px] font-bold uppercase" style={{ color: GOLD }}><Send className="w-3 h-3" /> Publish Now</button>}
            </div>
          </div>
        ))}
      </div>
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
      {tab === 'Schedule' && <ScheduleTab />}
      {tab === 'Setup' && <SetupTab />}
    </DashboardShell>
  )
}
