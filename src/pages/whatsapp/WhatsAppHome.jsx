import { MessageCircle } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function WhatsAppHome() {
  return (
    <EnginePanel
      title="Nova WhatsApp"
      description="WhatsApp Business conversations, handled the same way as SMS."
      emptyIcon={MessageCircle}
      emptyText="Not yet connected — requires a WhatsApp Business API account."
    />
  )
}
