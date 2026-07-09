import { Inbox } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function UnifiedInbox() {
  return (
    <EnginePanel
      title="Unified Inbox"
      description="Every conversation across Voice, SMS, WhatsApp, Email, and Social — in one stream."
      emptyIcon={Inbox}
      emptyText="No conversations yet."
    />
  )
}
