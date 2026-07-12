// Nova Tax — organizes Nova Finances expenses for tax purposes. Not tax advice — organization only.
import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'

const TAX_CATEGORIES = ['software_and_subscriptions', 'professional_services', 'equipment_and_technology', 'marketing_and_advertising', 'travel_and_mileage', 'meals_and_entertainment']

// ============================================================ ACTION: get_expense_summary =====

async function handleGetExpenseSummary(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json({ total: 0, by_category: {} })
  const q = req.query || {}
  const filters = []
  if (q.from) filters.push(`date=gte.${encodeURIComponent(q.from)}`)
  if (q.to) filters.push(`date=lte.${encodeURIComponent(q.to)}`)
  const query = filters.length ? `&${filters.join('&')}` : ''
  const r = await supabaseFetch(`nova_finances_expenses?select=amount,category,tax_category,date${query}&limit=2000`)
  const expenses = r.ok ? await r.json() : []
  const by_category = {}
  for (const e of expenses) {
    const cat = e.tax_category || e.category || 'other'
    by_category[cat] = (by_category[cat] || 0) + (Number(e.amount) || 0)
  }
  return res.status(200).json({ total: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), by_category, count: expenses.length })
}

// ============================================================ ACTION: get_calendar =============

const DEFAULT_DEADLINES = [
  { title: 'Q1 Estimated Taxes', category: 'quarterly', due_date: '-04-15' },
  { title: 'Q2 Estimated Taxes', category: 'quarterly', due_date: '-06-15' },
  { title: 'Q3 Estimated Taxes', category: 'quarterly', due_date: '-09-15' },
  { title: 'Q4 Estimated Taxes', category: 'quarterly', due_date: '-01-15' },
  { title: 'Annual Filing Deadline', category: 'annual', due_date: '-04-15' },
]

async function handleGetCalendar(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const existing = await supabaseFetch('nova_tax_calendar?select=id&limit=1')
  const rows = existing.ok ? await existing.json() : []
  if (!rows.length) {
    const year = new Date().getFullYear()
    await supabaseFetch('nova_tax_calendar', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(DEFAULT_DEADLINES.map((d) => ({ title: d.title, category: d.category, due_date: `${year}${d.due_date}` }))),
    }).catch(() => {})
  }
  const r = await supabaseFetch('nova_tax_calendar?order=due_date.asc')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ============================================================ ACTION: generate_report ==========

async function handleGenerateReport(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const from = sanitize(b.from, 20) || `${new Date().getFullYear()}-01-01`
  const to = sanitize(b.to, 20) || new Date().toISOString().slice(0, 10)
  if (!isSupabaseConfigured()) return res.status(500).json({ error: 'Supabase not configured' })

  const [expensesRes, invoicesRes] = await Promise.all([
    supabaseFetch(`nova_finances_expenses?date=gte.${from}&date=lte.${to}&order=date.asc`),
    supabaseFetch(`nova_finances_invoices?status=eq.paid&paid_at=gte.${from}&paid_at=lte.${to}T23:59:59&order=paid_at.asc`),
  ])
  const expenses = expensesRes.ok ? await expensesRes.json() : []
  const invoices = invoicesRes.ok ? await invoicesRes.json() : []
  const totalIncome = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  return res.status(200).json({
    ok: true, from, to, total_income: totalIncome, total_expenses: totalExpenses, net: totalIncome - totalExpenses,
    income_records: invoices.map((i) => ({ date: i.paid_at, client: i.client_name, amount: i.total })),
    expense_records: expenses.map((e) => ({ date: e.date, category: e.tax_category || e.category, description: e.description, amount: e.amount })),
  })
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Tax', ['SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'get_expense_summary': return await handleGetExpenseSummary(req, res)
      case 'get_calendar':        return await handleGetCalendar(req, res)
      case 'generate_report':     return await handleGenerateReport(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Tax] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
