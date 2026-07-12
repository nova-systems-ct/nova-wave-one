const GOLD = '#C8A96E'

export default function Footer() {
  return (
    <footer className="px-8 pt-10 pb-6" style={{ borderTop: '1px solid #2A2A2A' }}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-[10px]" style={{ color: '#444444' }}>&copy; {new Date().getFullYear()} Nova Systems. All rights reserved.</p>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
          <p className="text-[10px] tracking-widest uppercase" style={{ color: '#555555' }}>Waterbury, Connecticut</p>
          <div className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
        </div>
      </div>
    </footer>
  )
}
