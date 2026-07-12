// Nova Client — self-service client portal. Separate auth from Isaac's admin login: clients
// sign in with email + password against nova_client_accounts (SHA-256 hash, Node's built-in
// crypto — no external auth dependency needed for this scope).
import crypto from 'crypto'
import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// ============================================================ ACTION: login ===================

async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const email = sanitizeEmail(b.email)
  const password = typeof b.password === 'string' ? b.password : ''
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch(`nova_client_accounts?email=eq.${encodeURIComponent(email)}&limit=1`)
  const account = r.ok ? (await r.json())[0] : null
  if (!account || account.password_hash !== hashPassword(password) || account.status !== 'active') {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  return res.status(200).json({ ok: true, account: { id: account.id, business_name: account.business_name, email: account.email, crm_contact_id: account.crm_contact_id } })
}

// ============================================================ ACTION: get_client_data ==========

async function handleGetClientData(req, res) {
  const id = sanitize(req.query?.id, 100)
  if (!id || !isSupabaseConfigured()) return res.status(400).json({ error: 'id is required' })
  const r = await supabaseFetch(`nova_client_accounts?id=eq.${encodeURIComponent(id)}&limit=1`)
  const account = r.ok ? (await r.json())[0] : null
  if (!account) return res.status(404).json({ error: 'Not found' })

  let stats = { calls: 0, texts: 0, reviews: 0, leads: 0 }
  if (account.crm_contact_id) {
    const actsRes = await supabaseFetch(`nova_crm_activities?contact_id=eq.${account.crm_contact_id}&select=engine`)
    const activities = actsRes.ok ? await actsRes.json() : []
    stats.calls = activities.filter((a) => a.engine === 'voice').length
    stats.texts = activities.filter((a) => a.engine === 'sms' || a.engine === 'whatsapp').length
  }
  return res.status(200).json({ account, stats })
}

// ============================================================ ACTION: get_invoices =============

async function handleGetInvoices(req, res) {
  const email = sanitizeEmail(req.query?.email)
  if (!email || !isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch(`nova_finances_invoices?client_email=eq.${encodeURIComponent(email)}&order=created_at.desc`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: get_messages =============

async function handleGetMessages(req, res) {
  const client_account_id = sanitize(req.query?.client_account_id, 100)
  if (!client_account_id || !isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch(`nova_client_messages?client_account_id=eq.${encodeURIComponent(client_account_id)}&order=created_at.asc`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: send_message =============

async function handleSendMessage(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const client_account_id = sanitize(b.client_account_id, 100)
  const message = sanitize(b.message, 4000)
  if (!client_account_id || !message) return res.status(400).json({ error: 'client_account_id and message are required' })
  const r = await supabaseFetch('nova_client_messages', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ client_account_id, direction: 'from_client', message, read: false }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to send message' })
  return res.status(200).json({ ok: true })
}

// ============================================================ ACTION: get_files ================

async function handleGetFiles(req, res) {
  const client_account_id = sanitize(req.query?.client_account_id, 100)
  if (!client_account_id || !isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch(`nova_client_files?client_account_id=eq.${encodeURIComponent(client_account_id)}&order=created_at.desc`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: upload_file ===============
// Accepts a base64 data URL directly (small files only) — no separate object storage wiring in
// this pass; file_url is stored as-is (a data URL or externally hosted link).

async function handleUploadFile(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const client_account_id = sanitize(b.client_account_id, 100)
  const file_name = sanitize(b.file_name, 300)
  const file_url = typeof b.file_url === 'string' ? b.file_url.slice(0, 2000000) : ''
  if (!client_account_id || !file_name || !file_url) return res.status(400).json({ error: 'client_account_id, file_name, and file_url are required' })
  const r = await supabaseFetch('nova_client_files', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ client_account_id, file_name, file_url, uploaded_by: 'client' }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Upload failed' })
  return res.status(200).json({ ok: true })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Client', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'login':            return await handleLogin(req, res)
      case 'get_client_data':  return await handleGetClientData(req, res)
      case 'get_invoices':     return await handleGetInvoices(req, res)
      case 'get_messages':     return await handleGetMessages(req, res)
      case 'send_message':     return await handleSendMessage(req, res)
      case 'get_files':        return await handleGetFiles(req, res)
      case 'upload_file':      return await handleUploadFile(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Client] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
