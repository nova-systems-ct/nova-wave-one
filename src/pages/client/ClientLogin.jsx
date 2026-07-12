import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NovaLogo from '../../components/NovaLogo'
import { ClientAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const inputStyle = { width: '100%', padding: '12px 14px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' }

export default function ClientLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { account } = await ClientAPI.login({ email, password })
      localStorage.setItem('nova_client_account', JSON.stringify(account))
      navigate('/client/dashboard')
    } catch (err) {
      setError('Invalid email or password. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#080808' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <NovaLogo size={40} />
          <p className="mt-4 text-xs font-bold tracking-[0.3em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</p>
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-white mt-1">CLIENT PORTAL</p>
        </div>
        <form onSubmit={submit} className="rounded-xl p-8 space-y-4" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          {error && <div className="px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>{error}</div>}
          <input required type="email" style={inputStyle} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required type="password" style={inputStyle} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} className="w-full py-3.5 text-xs font-bold tracking-[0.2em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center mt-6 text-[11px]" style={{ color: '#666666' }}>Not a client yet? <a href="https://nova-systems.app" style={{ color: GOLD }}>nova-systems.app</a></p>
      </div>
    </div>
  )
}
