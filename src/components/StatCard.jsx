export default function StatCard({ icon: Icon, label, value, trend }) {
  return (
    <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      <div className="flex items-center justify-between mb-4">
        {Icon && <Icon className="w-4 h-4" style={{ color: '#C8A96E' }} />}
        {trend && <span className="text-[11px] font-semibold" style={{ color: trend.startsWith('-') ? '#f87171' : '#4ade80' }}>{trend}</span>}
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color: '#C8A96E', letterSpacing: '-0.02em' }}>{value}</p>
      <p className="text-xs" style={{ color: '#999999' }}>{label}</p>
    </div>
  )
}
