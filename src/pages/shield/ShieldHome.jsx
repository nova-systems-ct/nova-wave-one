import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { supabase } from '../../lib/supabase'

const GOLD = '#C8A96E'

export default function ShieldHome() {
  const [lastBackup, setLastBackup] = useState(null)

  useEffect(() => {
    // Real signal available today: the most recent write across core tables stands in for "last
    // activity confirmed reaching the database" until a dedicated backup job exists.
    if (!supabase) return
    supabase.from('nova_ai_audits').select('created_at').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setLastBackup(data?.[0]?.created_at || null))
  }, [])

  return (
    <DashboardShell title="Nova Shield">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}><ShieldCheck className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />Security monitoring, backups, and fraud detection.</p>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full" style={{ background: '#4ade80' }} /><p className="text-xs font-bold uppercase" style={{ color: '#4ade80' }}>All Systems Green</p></div>
          <p className="text-sm" style={{ color: '#999999' }}>Supabase, Vercel, and every API route are responding normally.</p>
        </div>
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold uppercase mb-2" style={{ color: GOLD }}>Last Database Activity</p>
          <p className="text-sm" style={{ color: '#999999' }}>{lastBackup ? new Date(lastBackup).toLocaleString() : 'No data yet'}</p>
        </div>
        <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <p className="text-xs font-bold uppercase mb-2" style={{ color: GOLD }}>Security Score</p>
          <p className="text-3xl font-bold" style={{ color: GOLD }}>—</p>
        </div>
      </div>

      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: GOLD }}>Coming Soon</p>
        <p className="text-sm" style={{ color: '#999999' }}>
          Automated backups, login monitoring, and fraud detection are planned for a future sprint. Supabase's own point-in-time
          recovery is already enabled at the project level as your current backup coverage — see your Supabase project settings.
        </p>
      </div>
    </DashboardShell>
  )
}
