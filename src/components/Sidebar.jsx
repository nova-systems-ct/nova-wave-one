import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutGrid, Search, DollarSign as SalesIcon, Radio, Image, Share2, Star,
  Phone, MessageSquare, MessageCircle, Mail, CalendarClock,
  Database, Brain, BookOpen, Workflow, Users, LineChart,
  Wallet, Receipt,
  Scale, UserPlus, ShieldCheck, FileText,
  Bot, Mic, Settings, List, ExternalLink, ChevronDown,
} from 'lucide-react'
import NovaLogo from './NovaLogo'

const GOLD = '#C8A96E'

// Department accent colors — used for the section header dot and hover states, per the "GROW
// gold, COMMUNICATE blue, OPERATE purple, MONEY green, BUSINESS red" spec.
const DEPARTMENTS = [
  {
    key: 'grow', label: 'Grow', color: '#C8A96E',
    items: [
      { to: '/dashboard/audit', label: 'Nova Audit', icon: Search },
      { to: '/dashboard/sales', label: 'Nova Sales', icon: SalesIcon },
      { to: '/dashboard/tron', label: 'Nova Tron', icon: Radio },
      { to: '/dashboard/media', label: 'Nova Media', icon: Image },
      { to: '/dashboard/social', label: 'Nova Social', icon: Share2 },
      { to: '/dashboard/reviews', label: 'Nova Reviews', icon: Star },
    ],
  },
  {
    key: 'communicate', label: 'Communicate', color: '#60a5fa',
    items: [
      { to: '/dashboard/voice', label: 'Nova Voice', icon: Phone },
      { to: '/dashboard/sms', label: 'Nova Blue', icon: MessageSquare },
      { to: '/dashboard/whatsapp', label: 'Nova WhatsApp', icon: MessageCircle },
      { to: '/dashboard/email', label: 'Nova Email', icon: Mail },
      { to: '/dashboard/book', label: 'Nova Book', icon: CalendarClock },
    ],
  },
  {
    key: 'operate', label: 'Operate', color: '#a78bfa',
    items: [
      { to: '/dashboard/crm', label: 'Nova CRM', icon: Database },
      { to: '/dashboard/crm/contacts', label: 'Nova Memory', icon: Brain },
      { to: '/dashboard/knowledge', label: 'Nova Knowledge', icon: BookOpen },
      { to: '/dashboard/flow', label: 'Nova Flow', icon: Workflow },
      { to: '/dashboard/client-portal', label: 'Nova Client', icon: Users },
      { to: '/dashboard/insights', label: 'Nova Insights', icon: LineChart },
    ],
  },
  {
    key: 'money', label: 'Money', color: '#4ade80',
    items: [
      { to: '/dashboard/finances', label: 'Nova Finances', icon: Wallet },
      { to: '/dashboard/tax', label: 'Nova Tax', icon: Receipt },
    ],
  },
  {
    key: 'business', label: 'Business', color: '#f87171',
    items: [
      { to: '/dashboard/law', label: 'Nova Law', icon: Scale },
      { to: '/dashboard/hire', label: 'Nova Hire', icon: UserPlus },
      { to: '/dashboard/shield', label: 'Nova Shield', icon: ShieldCheck },
      { to: '/dashboard/docs', label: 'Nova Docs', icon: FileText },
    ],
  },
]

const BOTTOM_ITEMS = [
  { to: '/dashboard/agents', label: 'Agents', icon: Bot },
  { to: '/dashboard/agents/voices', label: 'Voices', icon: Mic },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  { to: '/dashboard/logs', label: 'Logs', icon: List },
]

function pathOnly(to) { return to.split('?')[0] }

export default function Sidebar() {
  const loc = useLocation()
  const [collapsed, setCollapsed] = useState({})
  const active = (to) => {
    const p = pathOnly(to)
    return p === '/dashboard' ? loc.pathname === p : loc.pathname.startsWith(p)
  }
  const toggle = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))

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
        <div className="mb-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors"
            style={{ color: active('/dashboard') && loc.pathname === '/dashboard' ? '#fff' : '#999999', background: loc.pathname === '/dashboard' ? 'rgba(200,169,110,0.08)' : 'transparent' }}
          >
            <LayoutGrid className="w-4 h-4 flex-shrink-0" style={{ color: loc.pathname === '/dashboard' ? GOLD : '#666666' }} />
            Overview
          </Link>
        </div>

        {DEPARTMENTS.map((dept) => {
          const isCollapsed = !!collapsed[dept.key]
          return (
            <div key={dept.key} className="mb-3">
              <button
                onClick={() => toggle(dept.key)}
                className="w-full flex items-center gap-2 px-2 py-2 mb-1 text-[10px] font-bold tracking-[0.18em] uppercase transition-colors"
                style={{ color: '#666666' }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dept.color }} />
                <span className="flex-1 text-left">{dept.label}</span>
                <ChevronDown className="w-3 h-3 transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }} />
              </button>
              {!isCollapsed && dept.items.map((item) => {
                const on = active(item.to)
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors"
                    style={{ color: on ? '#fff' : '#999999', background: on ? 'rgba(200,169,110,0.08)' : 'transparent' }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: on ? dept.color : '#666666' }} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2A2A2A' }}>
          {BOTTOM_ITEMS.map((item) => {
            const on = active(item.to)
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
