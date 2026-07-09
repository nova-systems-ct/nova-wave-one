import { Phone } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function VoiceHome() {
  return (
    <EnginePanel
      title="Nova Voice"
      description="AI phone agents answering every call 24/7 in English and Spanish. Backed by api/nova-voice — incoming-call.js handles the Twilio webhook, stream.js is the real-time audio pipeline meant for the always-on Render server."
      emptyIcon={Phone}
      emptyText="No agents configured yet. Create one from the Agents tab."
    />
  )
}
