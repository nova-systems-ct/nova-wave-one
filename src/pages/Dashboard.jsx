import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Bot, Phone, MessageSquare, Mail, Target, DollarSign, Share2, Search, RefreshCcw, Send, Plus, Inbox, FileDown } from 'lucide-react'
import DashboardShell from '../components/DashboardShell'
import StatCard from '../components/StatCard'
import { supabase } from '../lib/supabase'

const GOLD = '#C8A96E'

const CHANNEL_ICON = { call: Phone, sms: MessageSquare, whatsapp: MessageSquare, email: Mail, social: Share2, revive: RefreshCcw }
const CHANNEL_COLOR = { call: '#a78bfa', sms: '#60a5fa', whatsapp: '#25D366', email: '#2dd4bf', social: GOLD, revive: '#f59e0b' }

const QUICK_ACTIONS = [
  { label: 'Run New Audit', icon: Search, to: '/dashboard/audit' },
  { label: 'Send Campaign', icon: Send, to: '/dashboard/email/campaigns' },
  { label: 'Create Agent', icon: Plus, to: '/dashboard/agents' },
  { label: 'View Inbox', icon: Inbox, to: '/dashboard/inbox' },
  { label: 'Check Cold Leads', icon: RefreshCcw, to: '/dashboard/revive' },
  { label: 'Download Report', icon: FileDown, to: '/dashboard/audit/reports' },
]

function last30Days() {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  return days
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    agents: 0, callsToday: 0, smsToday: 0, emailsToday: 0, socialToday: 0, auditsToday: 0,
    leadsRevivedToday: 0, meetingsBooked: 0, pipelineValue: 0,
  })
  const [activity, setActivity] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!supabase) { setLoading(false); return }
      const today = new Date(); today.setHours(0, 0, 0, 0)

      try {
        const [agentsRes, callsRes, smsRes, emailRes, socialRes, auditsTodayRes, reviveTodayRes, meetingsRes, pipelineRes] = await Promise.all([
          supabase.from('nova_ai_agents').select('id', { count: 'exact', head: true }),
          supabase.from('nova_ai_calls').select('id,created_at').gte('created_at', today.toISOString()),
          supabase.from('nova_ai_sms_logs').select('id,created_at').gte('created_at', today.toISOString()),
          supabase.from('nova_ai_email_logs').select('id,created_at').gte('created_at', today.toISOString()),
          supabase.from('nova_ai_social_logs').select('id,created_at').gte('created_at', today.toISOString()),
          supabase.from('nova_ai_audits').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
          supabase.from('nova_ai_revive_logs').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
          supabase.from('nova_ai_audits').select('id', { count: 'exact', head: true }).eq('meeting_booked', true),
          supabase.from('nova_ai_audits').select('revenue_leak_monthly').eq('became_client', false),
        ])

        setStats({
          agents: agentsRes.count || 0,
          callsToday: callsRes.data?.length || 0,
          smsToday: smsRes.data?.length || 0,
          emailsToday: emailRes.data?.length || 0,
          socialToday: socialRes.data?.length || 0,
          auditsToday: auditsTodayRes.count || 0,
          leadsRevivedToday: reviveTodayRes.count || 0,
          meetingsBooked: meetingsRes.count || 0,
          pipelineValue: (pipelineRes.data || []).reduce((sum, r) => sum + (Number(r.revenue_leak_monthly) || 0), 0),
        })

        const [recentCalls, recentSms, recentEmails, recentSocial, recentRevive] = await Promise.all([
          supabase.from('nova_ai_calls').select('id,caller_phone,outcome,created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('nova_ai_sms_logs').select('id,contact_phone,direction,platform,created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('nova_ai_email_logs').select('id,from_email,category,created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('nova_ai_social_logs').select('id,platform,from_user,event_type,created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('nova_ai_revive_logs').select('id,channel,outcome,created_at').order('created_at', { ascending: false }).limit(6),
        ])

        const merged = [
          ...(recentCalls.data || []).map((c) => ({ id: `call-${c.id}`, type: 'call', text: `Call ${c.outcome || 'logged'} — ${c.caller_phone || 'unknown'}`, ts: c.created_at })),
          ...(recentSms.data || []).map((s) => ({ id: `sms-${s.id}`, type: s.platform === 'whatsapp' ? 'whatsapp' : 'sms', text: `${s.direction === 'inbound' ? 'Inbound' : 'Outbound'} ${s.platform === 'whatsapp' ? 'WhatsApp' : 'text'} — ${s.contact_phone || 'unknown'}`, ts: s.created_at })),
          ...(recentEmails.data || []).map((e) => ({ id: `email-${e.id}`, type: 'email', text: `Email ${e.category || 'logged'} — ${e.from_email || 'unknown'}`, ts: e.created_at })),
          ...(recentSocial.data || []).map((s) => ({ id: `social-${s.id}`, type: 'social', text: `${s.platform || 'Social'} ${s.event_type || 'reply'} — ${s.from_user || 'unknown'}`, ts: s.created_at })),
          ...(recentRevive.data || []).map((r) => ({ id: `revive-${r.id}`, type: 'revive', text: `Revive ${r.channel || ''} — ${r.outcome || 'sent'}`, ts: r.created_at })),
        ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 12)

        setActivity(merged)

        const days = last30Days()
        const [callsRange, smsRange, emailRange] = await Promise.all([
          supabase.from('nova_ai_calls').select('created_at').gte('created_at', days[0].toISOString()),
          supabase.from('nova_ai_sms_logs').select('created_at').gte('created_at', days[0].toISOString()),
          supabase.from('nova_ai_email_logs').select('created_at').gte('created_at', days[0].toISOString()),
        ])
        setChartData(days.map((d) => {
          const next = new Date(d); next.setDate(next.getDate() + 1)
          const inRange = (rows) => (rows || []).filter((r) => { const t = new Date(r.created_at); return t >= d && t < next }).length
          return {
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            calls: inRange(callsRange.data), sms: inRange(smsRange.data), emails: inRange(emailRange.data),
          }
        }))
      } catch (err) {
        console.error('[Dashboard] Failed to load stats:', err.message)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <DashboardShell title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
        <StatCard icon={Phone} label="Calls Today" value={loading ? '—' : stats.callsToday} />
        <StatCard icon={MessageSquare} label="SMS Sent Today" value={loading ? '—' : stats.smsToday} />
        <StatCard icon={Mail} label="Emails Today" value={loading ? '—' : stats.emailsToday} />
        <StatCard icon={Share2} label="Social Replies Today" value={loading ? '—' : stats.socialToday} />
        <StatCard icon={Search} label="Audits Today" value={loading ? '—' : stats.auditsToday} />
        <StatCard icon={RefreshCcw} label="Leads Revived Today" value={loading ? '—' : stats.leadsRevivedToday} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={DollarSign} label="Pipeline Value / mo" value={loading ? '—' : `$${stats.pipelineValue.toLocaleString()}`} />
        <StatCard icon={Bot} label="Active Agents" value={loading ? '—' : stats.agents} />
        <StatCard icon={Target} label="Meetings Booked" value={loading ? '—' : stats.meetingsBooked} />
      </div>

      <div className="grid xl:grid-cols-5 gap-4 mb-6">
        <div className="xl:col-span-3 rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold tracking-[0.15em] uppercase mb-5" style={{ color: GOLD }}>Live Activity</p>
          {activity.length === 0 ? (
            <p className="text-sm" style={{ color: '#666666' }}>No activity yet.</p>
          ) : (
            <div className="space-y-0">
              {activity.map((a, i) => {
                const Icon = CHANNEL_ICON[a.type] || Phone
                const color = CHANNEL_COLOR[a.type] || GOLD
                return (
                  <div key={a.id} className="flex items-center gap-3 py-3" style={{ borderBottom: i < activity.length - 1 ? '1px solid #2A2A2A' : 'none' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <p className="text-sm flex-1" style={{ color: '#fff' }}>{a.text}</p>
                    <p className="text-[11px]" style={{ color: '#666666' }}>{new Date(a.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="xl:col-span-2 rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold tracking-[0.15em] uppercase mb-5" style={{ color: GOLD }}>Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map(({ label, icon: Icon, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="flex flex-col items-start gap-2 p-4 rounded-lg text-left transition-colors"
                style={{ background: '#080808', border: '1px solid #2A2A2A' }}
              >
                <Icon className="w-4 h-4" style={{ color: GOLD }} />
                <span className="text-xs font-semibold" style={{ color: '#fff' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-5" style={{ color: GOLD }}>Performance — Last 30 Days</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="date" tick={{ fill: '#666666', fontSize: 10 }} interval={4} />
            <YAxis allowDecimals={false} tick={{ fill: '#666666', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#0E0E0E', border: '1px solid #2A2A2A', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="calls" name="Calls" stroke="#a78bfa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sms" name="SMS" stroke="#60a5fa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="emails" name="Emails" stroke="#2dd4bf" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardShell>
  )
}
