import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NovaLogo from '../components/NovaLogo'

const SESSION_KEY = 'nova_wave_intro_seen'
const GOLD = '#C8A96E'

export default function Home() {
  const navigate = useNavigate()
  // Read once at mount (not re-read later) so React 18 StrictMode's dev-only double-invoke of
  // effects can't race this against the sessionStorage.setItem below and self-redirect immediately.
  const [alreadySeen] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true')
  const [stage, setStage] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (alreadySeen) {
      navigate('/login', { replace: true })
      return
    }
    sessionStorage.setItem(SESSION_KEY, 'true')

    const timers = [
      setTimeout(() => setStage(1), 1500),  // logo pulse
      setTimeout(() => setStage(2), 2000),  // NOVA SYSTEMS
      setTimeout(() => setStage(3), 3000),  // WAVE ONE
      setTimeout(() => setStage(4), 3500),  // gold line
      setTimeout(() => setStage(5), 4000),  // ENTER button
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const enter = () => {
    setExiting(true)
    setTimeout(() => navigate('/login'), 500)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: '#080808', opacity: exiting ? 0 : 1, transition: 'opacity 0.5s ease' }}
    >
      <style>{`
        @keyframes nwFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nwPulse { 0%,100% { filter: drop-shadow(0 0 0px ${GOLD}); } 50% { filter: drop-shadow(0 0 18px ${GOLD}); } }
        @keyframes nwLine { from { width: 0; } to { width: 200px; } }
        .nw-letters span { opacity: 0; animation: nwFadeIn 0.15s ease forwards; }
      `}</style>

      <div style={{ opacity: 1, animation: 'nwFadeIn 1.5s ease forwards' }}>
        <div style={{ animation: stage >= 1 ? 'nwPulse 1.2s ease-in-out 1' : 'none' }}>
          <NovaLogo size={64} />
        </div>
      </div>

      {stage >= 2 && (
        <p className="nw-letters mt-8 text-xl font-bold tracking-[0.4em] uppercase" style={{ color: GOLD }}>
          {'NOVA SYSTEMS'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${i * 40}ms` }}>{c === ' ' ? ' ' : c}</span>
          ))}
        </p>
      )}

      {stage >= 3 && (
        <p className="mt-3 text-sm font-semibold tracking-[0.35em] uppercase text-white" style={{ animation: 'nwFadeIn 1s ease forwards' }}>
          WAVE ONE
        </p>
      )}

      {stage >= 4 && (
        <div className="mt-8" style={{ height: 1, background: GOLD, animation: 'nwLine 0.6s ease forwards' }} />
      )}

      {stage >= 5 && (
        <button
          onClick={enter}
          className="mt-12 px-10 py-3 text-xs font-bold tracking-[0.25em] uppercase transition-all"
          style={{ border: `1px solid ${GOLD}`, color: GOLD, background: 'transparent', animation: 'nwFadeIn 0.8s ease forwards' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = '#080808' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = GOLD }}
        >
          ENTER
        </button>
      )}
    </div>
  )
}
