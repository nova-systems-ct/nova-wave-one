import { MessageSquare } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function SMSHome() {
  return (
    <EnginePanel
      title="Nova Blue — SMS"
      description="AI SMS agent following up with every lead automatically. Backed by api/nova-sms."
      emptyIcon={MessageSquare}
      emptyText="No SMS conversations yet."
    />
  )
}
