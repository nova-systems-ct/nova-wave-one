// Nova Finances — invoicing (Stripe payment links), MRR tracking, expenses, profit.
import { setCors } from '../_cors.js'
import { sanitize, sanitizeEmail } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'

const EXPENSE_CATEGORIES = ['software_subscriptions', 'api_costs', 'contractor_payments', 'equipment', 'marketing', 'other']

let _stripe = null
async function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  if (!_stripe) {
    const { default: Stripe } = await import('stripe')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripe
}

// ============================================================ ACTION: create_invoice =========

async function handleCreateInvoice(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const client_name = sanitize(b.client_name, 200)
  const client_email = b.client_email ? sanitizeEmail(b.client_email) : null
  const services = Array.isArray(b.services) ? b.services : []
  if (!client_name || !services.length) return res.status(400).json({ error: 'client_name and at least one service are required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const subtotal = services.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const tax = Number(b.tax) || 0
  const total = subtotal + tax

  let stripe_payment_link = null
  const stripe = await stripeClient()
  if (stripe) {
    try {
      const price = await stripe.prices.create({
        currency: 'usd', unit_amount: Math.round(total * 100),
        product_data: { name: `Nova Systems Invoice — ${client_name}` },
      })
      const link = await stripe.paymentLinks.create({ line_items: [{ price: price.id, quantity: 1 }] })
      stripe_payment_link = link.url
    } catch (err) {
      console.error('[nova-finances:create_invoice] Stripe payment link failed (invoice still saved):', err.message)
    }
  }

  const r = await supabaseFetch('nova_finances_invoices', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ client_name, client_email, services, subtotal, tax, total, due_date: b.due_date || null, status: 'unpaid', stripe_payment_link }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to create invoice' })
  const invoice = (await r.json())[0]

  if (client_email && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Nova Systems <hello@nova-systems.app>', to: [client_email],
          subject: `Invoice from Nova Systems — $${total.toLocaleString()}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
            <div style="background:#080808;padding:24px;text-align:center;"><span style="color:#C8A96E;font-weight:900;letter-spacing:2px;">NOVA SYSTEMS</span></div>
            <div style="padding:28px;border:1px solid #eee;border-top:none;">
              <h2>Invoice — $${total.toLocaleString()}</h2>
              <ul>${services.map((s) => `<li>${s.description || s.name} — $${Number(s.amount).toLocaleString()}</li>`).join('')}</ul>
              ${stripe_payment_link ? `<p><a href="${stripe_payment_link}" style="background:#C8A96E;color:#080808;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Pay Now</a></p>` : ''}
            </div></div>`,
        }),
      })
    } catch (err) { console.error('[nova-finances:create_invoice] Email send failed (non-fatal):', err.message) }
  }

  return res.status(200).json({ ok: true, invoice })
}

// ============================================================ ACTION: get_invoices ============

async function handleGetInvoices(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const q = req.query || {}
  const filters = q.status ? `&status=eq.${encodeURIComponent(q.status)}` : ''
  const r = await supabaseFetch(`nova_finances_invoices?order=created_at.desc&limit=200${filters}`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: update_invoice_status ==

async function handleUpdateInvoiceStatus(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const id = sanitize(b.id, 100)
  const status = ['unpaid', 'paid', 'overdue'].includes(b.status) ? b.status : null
  if (!id || !status) return res.status(400).json({ error: 'id and a valid status are required' })
  const patch = { status }
  if (status === 'paid') patch.paid_at = new Date().toISOString()
  const r = await supabaseFetch(`nova_finances_invoices?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
  if (!r.ok) return res.status(500).json({ error: 'Update failed' })
  return res.status(200).json({ ok: true })
}

// ============================================================ ACTION: create_expense ==========

async function handleCreateExpense(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const category = EXPENSE_CATEGORIES.includes(b.category) ? b.category : 'other'
  const amount = Number(b.amount)
  if (!amount) return res.status(400).json({ error: 'amount is required' })
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const r = await supabaseFetch('nova_finances_expenses', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ category, description: sanitize(b.description, 500), amount, date: b.date || new Date().toISOString().slice(0, 10) }),
  })
  if (!r.ok) return res.status(500).json({ error: 'Failed to save expense' })
  return res.status(200).json({ ok: true, expense: (await r.json())[0] })
}

// ============================================================ ACTION: get_expenses ============

async function handleGetExpenses(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_finances_expenses?order=date.desc&limit=500')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: get_mrr =================
// MRR = sum of active clients' latest paid invoice total, treated as their recurring monthly fee.

async function handleGetMrr(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ mrr: 0, clients: [] })
  const r = await supabaseFetch("nova_finances_invoices?status=eq.paid&order=paid_at.desc&limit=500")
  const invoices = r.ok ? await r.json() : []
  const byClient = {}
  for (const inv of invoices) { if (!byClient[inv.client_name]) byClient[inv.client_name] = inv }
  const clients = Object.values(byClient)
  const mrr = clients.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0)
  return res.status(200).json({ mrr, clients: clients.map((c) => ({ client_name: c.client_name, monthly: c.total })), annual_projection: mrr * 12 })
}

// ============================================================ ACTION: get_profit ==============

async function handleGetProfit(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ mrr: 0, expenses: 0, profit: 0 })
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const [mrrRes, expensesRes] = await Promise.all([
    supabaseFetch("nova_finances_invoices?status=eq.paid&select=total,client_name,paid_at&order=paid_at.desc&limit=500"),
    supabaseFetch(`nova_finances_expenses?date=gte.${monthStart.toISOString().slice(0, 10)}&select=amount`),
  ])
  const invoices = mrrRes.ok ? await mrrRes.json() : []
  const byClient = {}
  for (const inv of invoices) { if (!byClient[inv.client_name]) byClient[inv.client_name] = inv }
  const mrr = Object.values(byClient).reduce((sum, inv) => sum + (Number(inv.total) || 0), 0)
  const expenses = (expensesRes.ok ? await expensesRes.json() : []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  return res.status(200).json({ mrr, expenses, profit: mrr - expenses })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Finances', ['STRIPE_SECRET_KEY', 'VITE_STRIPE_PUBLISHABLE_KEY', 'RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'create_invoice':        return await handleCreateInvoice(req, res)
      case 'get_invoices':          return await handleGetInvoices(req, res)
      case 'update_invoice_status': return await handleUpdateInvoiceStatus(req, res)
      case 'create_expense':        return await handleCreateExpense(req, res)
      case 'get_expenses':          return await handleGetExpenses(req, res)
      case 'get_mrr':                return await handleGetMrr(req, res)
      case 'get_profit':             return await handleGetProfit(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Finances] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
