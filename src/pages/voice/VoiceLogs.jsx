import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'
import { api } from '../../lib/api'

export default function VoiceLogs() {
  const [calls, setCalls] = useState([])
  useEffect(() => {
    api.get('/api/nova-voice', { action: 'get_calls' }).then((d) => setCalls(Array.isArray(d) ? d : [])).catch(() => setCalls([]))
  }, [])

  return (
    <EnginePanel title="Call Logs" description="Every inbound and outbound call, transcribed and logged to nova_ai_calls.">
      {calls.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <Phone className="w-8 h-8 mx-auto mb-4" style={{ color: '#2A2A2A' }} />
          <p className="text-sm" style={{ color: '#666666' }}>No calls logged yet.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          {calls.map((c) => (
            <div key={c.id} className="px-5 py-3 text-sm" style={{ borderBottom: '1px solid #2A2A2A', color: '#ccc' }}>{c.caller_phone} — {c.outcome}</div>
          ))}
        </div>
      )}
    </EnginePanel>
  )
}
