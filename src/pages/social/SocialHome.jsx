import { Share2 } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function SocialHome() {
  return (
    <EnginePanel
      title="Nova Social"
      description="AI handling every Instagram, TikTok, Facebook, and LinkedIn DM and comment. Backed by api/nova-social."
      emptyIcon={Share2}
      emptyText="No connected accounts yet."
    />
  )
}
