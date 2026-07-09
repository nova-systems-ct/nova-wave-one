import { Bell } from 'lucide-react'

export default function Navbar({ title }) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-8"
      style={{ height: 64, background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #2A2A2A' }}
    >
      <h1 className="text-base font-bold text-white">{title}</h1>
      <button className="relative p-2 rounded-lg transition-colors" style={{ color: '#999999' }}>
        <Bell className="w-[18px] h-[18px]" />
      </button>
    </div>
  )
}
