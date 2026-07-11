// Server-side session verification for the handful of routes that touch third-party API
// credentials (api/auth's get_settings/set_settings). Verifies the caller's Supabase access
// token against Supabase's own Auth server — nothing here trusts anything the client claims
// about itself, only a token Supabase itself issued at login.
export async function requireAuthenticatedUser(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[_auth] Cannot verify session — Supabase is not configured on the server')
    res.status(500).json({ error: 'Server auth is not configured' })
    return null
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      res.status(401).json({ error: 'Invalid or expired session' })
      return null
    }
    const user = await r.json()
    if (!user?.id) {
      res.status(401).json({ error: 'Invalid or expired session' })
      return null
    }
    return user
  } catch (err) {
    console.error('[_auth:requireAuthenticatedUser] Verification failed:', err.message)
    res.status(401).json({ error: 'Authentication check failed' })
    return null
  }
}
