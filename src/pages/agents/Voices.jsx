import { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'
import { api } from '../../lib/api'

export default function Voices() {
  const [voices, setVoices] = useState([])
  useEffect(() => {
    api.get('/api/nova-voice', { action: 'get_voices' }).then((d) => setVoices(Array.isArray(d) ? d : [])).catch(() => setVoices([]))
  }, [])

  return (
    <EnginePanel title="Voices" description="ElevenLabs voice profiles available to every agent.">
      {voices.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <Mic className="w-8 h-8 mx-auto mb-4" style={{ color: '#2A2A2A' }} />
          <p className="text-sm" style={{ color: '#666666' }}>No voices configured yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map((v) => (
            <div key={v.id} className="rounded-xl p-5" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
              <p className="text-sm font-bold text-white">{v.voice_name}</p>
              <p className="text-xs mt-1" style={{ color: '#666666' }}>{v.description}</p>
            </div>
          ))}
        </div>
      )}
    </EnginePanel>
  )
}
