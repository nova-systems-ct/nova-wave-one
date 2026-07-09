import { MessageSquare } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function SMSConversations() {
  return (
    <EnginePanel
      title="SMS Conversations"
      description="Full thread view of every SMS conversation, grouped by contact."
      emptyIcon={MessageSquare}
      emptyText="No conversations yet."
    />
  )
}
