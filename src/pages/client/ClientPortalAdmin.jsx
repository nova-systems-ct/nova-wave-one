import { Users, ExternalLink } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'

const GOLD = '#C8A96E'

export default function ClientPortalAdmin() {
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/client/login` : '/client/login'
  return (
    <DashboardShell title="Nova Client">
      <p className="text-sm mb-6 max-w-xl" style={{ color: '#999999' }}>
        <Users className="w-4 h-4 inline mr-1.5" style={{ color: GOLD }} />
        Every Nova Systems client gets their own login to view invoices, pay, book calls, message the team, and see their AI engine stats.
      </p>
      <div className="rounded-xl p-6 mb-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: GOLD }}>Client Portal Link</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-sm px-4 py-2.5 rounded-lg" style={{ background: '#080808', color: '#ccc' }}>{portalUrl}</code>
          <a href="/client/login" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}><ExternalLink className="w-3.5 h-3.5" /> Open</a>
        </div>
      </div>
      <div className="rounded-xl p-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <p className="text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: GOLD }}>Creating a Client Account</p>
        <p className="text-sm" style={{ color: '#999999' }}>
          Add a row to <code style={{ color: '#ccc' }}>nova_client_accounts</code> in Supabase with the client's business name, email, and a SHA-256 password hash
          (Node: <code style={{ color: '#ccc' }}>crypto.createHash('sha256').update(password).digest('hex')</code>), and link
          <code style={{ color: '#ccc' }}> crm_contact_id</code> to their Nova CRM contact so their stats and invoices populate automatically.
        </p>
      </div>
    </DashboardShell>
  )
}
