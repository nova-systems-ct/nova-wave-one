import { Inbox } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function SocialInbox() {
  return (
    <EnginePanel
      title="Social Inbox"
      description="Every DM and comment across connected platforms, in one place."
      emptyIcon={Inbox}
      emptyText="No messages yet."
    />
  )
}
