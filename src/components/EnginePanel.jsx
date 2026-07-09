import DashboardShell from './DashboardShell'
import StatCard from './StatCard'

const GOLD = '#C8A96E'

export default function EnginePanel({ title, description, stats = [], emptyIcon: Icon, emptyText, children }) {
  return (
    <DashboardShell title={title}>
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}>{description}</p>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((s) => <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} />)}
        </div>
      )}

      {children || (
        <div className="rounded-xl py-16 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          {Icon && <Icon className="w-8 h-8 mx-auto mb-4" style={{ color: '#2A2A2A' }} />}
          <p className="text-sm" style={{ color: '#666666' }}>{emptyText}</p>
        </div>
      )}
    </DashboardShell>
  )
}
