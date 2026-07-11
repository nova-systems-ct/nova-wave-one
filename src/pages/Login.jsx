import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NovaLogo from '../components/NovaLogo'
import { supabase } from '../lib/supabase'

const GOLD = '#C8A96E'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    width: '100%', padding: '12px 14px', background: '#080808',
    border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (supabase) {
      try {
        const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
        if (!authErr && data?.user) {
          localStorage.setItem('nova_wave_authenticated', 'true')
          navigate('/dashboard')
          setLoading(false)
          return
        }
      } catch {}
    }

    setError('Invalid credentials. This system is invite only.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#080808' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <NovaLogo size={40} />
          <p className="mt-4 text-xs font-bold tracking-[0.3em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</p>
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-white mt-1">WAVE ONE</p>
        </div>

        <div className="rounded-xl p-8" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: '#666666' }}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: '#666666' }}>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 text-xs font-bold tracking-[0.2em] uppercase rounded-lg transition-all"
              style={{ background: GOLD, color: '#080808', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Signing In…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-[11px] leading-relaxed" style={{ color: '#666666' }}>
          Access restricted to authorized Nova Systems personnel.<br />
          Contact <a href="mailto:hello@nova-systems.app" style={{ color: GOLD }}>hello@nova-systems.app</a> for access.
        </p>
      </div>
    </div>
  )
}
