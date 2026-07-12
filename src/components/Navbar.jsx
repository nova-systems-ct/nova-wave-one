import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import NovaLogo from './NovaLogo'

const GOLD = '#C8A96E'

export default function Navbar({ title }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)

  const logout = () => {
    localStorage.removeItem('nova_wave_authenticated')
    localStorage.removeItem('nova_wave_user')
    navigate('/login')
  }

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-8"
      style={{ height: 64, background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #2A2A2A' }}
    >
      <div className="flex items-center gap-3">
        <NovaLogo size={22} />
        <h1 className="text-base font-bold text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg transition-colors" style={{ color: '#999999' }}>
          <Bell className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={logout}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] rounded-lg transition-all"
          style={{ border: `1px solid ${GOLD}`, color: hover ? '#080808' : GOLD, background: hover ? GOLD : 'transparent' }}
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </div>
  )
}
