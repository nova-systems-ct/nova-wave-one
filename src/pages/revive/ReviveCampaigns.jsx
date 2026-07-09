import { RefreshCcw } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function ReviveCampaigns() {
  return (
    <EnginePanel
      title="Revive Campaigns"
      description="Monthly check-in campaigns for leads that never responded to outreach."
      emptyIcon={RefreshCcw}
      emptyText="No campaigns running yet."
    />
  )
}
