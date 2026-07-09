import { Link, useLocation } from 'react-router-dom'
import {
  LayoutGrid, Search, Inbox, Phone, MessageSquare, MessageCircle, Mail,
  Share2, RefreshCcw, Bot, BookOpen, Mic, Settings, List, ExternalLink,
} from 'lucide-react'
import NovaLogo from './NovaLogo'

const GOLD = '#C8A96E'

const SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, exact: true }],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/dashboard/audit', label: 'Nova Audit', icon: Search },
      { to: '/dashboard/inbox', label: 'Unified Inbox', icon: Inbox },
    ],
  },
  {
    label: 'Engines',
    items: [
      { to: '/dashboard/voice', label: 'Nova Voice', icon: Phone },
      { to: '/dashboard/sms', label: 'Nova Blue SMS', icon: MessageSquare },
      { to: '/dashboard/whatsapp', label: 'Nova WhatsApp', icon: MessageCircle },
      { to: '/dashboard/email', label: 'Nova Email', icon: Mail },
      { to: '/dashboard/social', label: 'Nova Social', icon: Share2 },
      { to: '/dashboard/revive', label: 'Nova Revive', icon: RefreshCcw },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/dashboard/agents', label: 'Agents', icon: Bot },
      { to: '/dashboard/agents/knowledge-bases', label: 'Knowledge Bases', icon: BookOpen },
      { to: '/dashboard/agents/voices', label: 'Voices', icon: Mic },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/dashboard/settings', label: 'Settings', icon: Settings },
      { to: '/dashboard/logs', label: 'Logs', icon: List },
    ],
  },
]

export default function Sidebar() {
  const loc = useLocation()
  const active = (item) => (item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to))

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col"
      style={{ width: 260, background: '#0E0E0E', borderRight: '1px solid #2A2A2A' }}
    >
      <div className="px-6 py-7 flex items-center gap-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
        <NovaLogo size={28} />
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em]" style={{ color: GOLD }}>NOVA</p>
          <p className="text-[10px] font-semibold tracking-[0.2em]" style={{ color: '#fff' }}>WAVE ONE</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-7">
            <p className="px-2 mb-2 text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: '#666666' }}>{section.label}</p>
            {section.items.map((item) => {
              const on = active(item)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors"
                  style={{ color: on ? '#fff' : '#999999', background: on ? 'rgba(200,169,110,0.08)' : 'transparent' }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: on ? GOLD : '#666666' }} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="px-5 py-5" style={{ borderTop: '1px solid #2A2A2A' }}>
        <p className="text-[10px] font-bold tracking-[0.15em] mb-1" style={{ color: GOLD }}>NOVA SYSTEMS</p>
        <a
          href="https://nova-systems.app"
          className="flex items-center gap-1.5 text-[11px] transition-colors"
          style={{ color: '#666666' }}
        >
          nova-systems.app <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </aside>
  )
}
