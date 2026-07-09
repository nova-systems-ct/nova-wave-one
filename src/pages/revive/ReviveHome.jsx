import { RefreshCcw } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function ReviveHome() {
  return (
    <EnginePanel
      title="Nova Revive"
      description="AI reactivating every dead lead in your database — including non-responders from the Nova Audit outreach sequence after 14 days. Backed by api/nova-revive."
      emptyIcon={RefreshCcw}
      emptyText="No leads in the revive queue yet."
    />
  )
}
