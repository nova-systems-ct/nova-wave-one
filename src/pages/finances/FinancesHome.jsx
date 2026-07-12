import { useEffect, useState } from 'react'
import { Wallet, Plus } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import StatCard from '../../components/StatCard'
import { FinancesAPI } from '../../lib/api'

const GOLD = '#C8A96E'
const TABS = ['Overview', 'Invoices', 'Expenses']
const inputStyle = { width: '100%', padding: '10px 12px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }
const STATUS_COLOR = { unpaid: '#f59e0b', paid: '#4ade80', overdue: '#f87171' }

function OverviewTab() {
  const [mrr, setMrr] = useState(null)
  const [profit, setProfit] = useState(null)
  useEffect(() => {
    FinancesAPI.getMrr().then(setMrr).catch(() => {})
    FinancesAPI.getProfit().then(setProfit).catch(() => {})
  }, [])
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={Wallet} label="Current MRR" value={mrr ? `$${mrr.mrr.toLocaleString()}` : '—'} />
      <StatCard icon={Wallet} label="Annual Projection" value={mrr ? `$${mrr.annual_projection.toLocaleString()}` : '—'} />
      <StatCard icon={Wallet} label="Expenses (This Month)" value={profit ? `$${profit.expenses.toLocaleString()}` : '—'} />
      <StatCard icon={Wallet} label="Monthly Profit" value={profit ? `$${profit.profit.toLocaleString()}` : '—'} />
    </div>
  )
}

function InvoicesTab() {
  const [invoices, setInvoices] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [serviceName, setServiceName] = useState('Wave One — Monthly')
  const [amount, setAmount] = useState('')
  const [creating, setCreating] = useState(false)

  const load = () => FinancesAPI.getInvoices({}).then((d) => setInvoices(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!clientName || !amount) return
    setCreating(true)
    try {
      await FinancesAPI.createInvoice({ client_name: clientName, client_email: clientEmail, services: [{ description: serviceName, amount: Number(amount) }] })
      setShowForm(false); setClientName(''); setClientEmail(''); setAmount('')
      load()
    } catch (err) { alert(err.message) }
    setCreating(false)
  }

  const markPaid = async (id) => { await FinancesAPI.updateInvoiceStatus({ id, status: 'paid' }).catch(() => {}); load() }

  return (
    <div>
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase rounded-lg mb-4" style={{ background: GOLD, color: '#080808' }}>
        <Plus className="w-3.5 h-3.5" /> New Invoice
      </button>
      {showForm && (
        <div className="rounded-xl p-6 mb-4" style={{ background: '#0E0E0E', border: `1px solid ${GOLD}40` }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input style={inputStyle} placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            <input style={inputStyle} placeholder="Client email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input style={inputStyle} placeholder="Service description" value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
            <input style={inputStyle} type="number" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <button onClick={create} disabled={creating} className="px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>{creating ? 'Creating…' : 'Create Invoice'}</button>
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        {invoices.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No invoices yet.</p> : invoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A2A2A' }}>
            <div>
              <p className="text-sm font-semibold text-white">{inv.client_name}</p>
              <p className="text-[11px]" style={{ color: '#666666' }}>${Number(inv.total).toLocaleString()} · {new Date(inv.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase" style={{ background: `${STATUS_COLOR[inv.status]}18`, color: STATUS_COLOR[inv.status] }}>{inv.status}</span>
              {inv.stripe_payment_link && <a href={inv.stripe_payment_link} target="_blank" rel="noreferrer" className="text-[11px] font-bold uppercase" style={{ color: GOLD }}>Pay Link</a>}
              {inv.status !== 'paid' && <button onClick={() => markPaid(inv.id)} className="text-[11px] font-bold uppercase" style={{ color: '#4ade80' }}>Mark Paid</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExpensesTab() {
  const [expenses, setExpenses] = useState([])
  const [category, setCategory] = useState('software_subscriptions')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => FinancesAPI.getExpenses({}).then((d) => setExpenses(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!amount) return
    setSaving(true)
    try { await FinancesAPI.createExpense({ category, description, amount: Number(amount) }); setDescription(''); setAmount(''); load() } catch (err) { alert(err.message) }
    setSaving(false)
  }

  return (
    <div>
      <div className="rounded-xl p-6 mb-4" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {['software_subscriptions', 'api_costs', 'contractor_payments', 'equipment', 'marketing', 'other'].map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <input style={inputStyle} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button onClick={create} disabled={saving} className="px-5 py-2.5 text-xs font-bold uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>{saving ? 'Saving…' : 'Add Expense'}</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
        {expenses.length === 0 ? <p className="p-6 text-sm" style={{ color: '#666666' }}>No expenses logged yet.</p> : expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-6 py-3 text-sm" style={{ borderBottom: '1px solid #2A2A2A', color: '#ccc' }}>
            <span>{e.description || e.category}</span>
            <span style={{ color: GOLD }}>${Number(e.amount).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FinancesHome() {
  const [tab, setTab] = useState('Overview')
  return (
    <DashboardShell title="Nova Finances">
      <div className="flex items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-[18px] py-[9px] text-[11px] font-bold uppercase rounded-lg" style={{ letterSpacing: '0.08em', border: `1px solid ${tab === t ? GOLD : '#2A2A2A'}`, color: tab === t ? '#080808' : '#999999', background: tab === t ? GOLD : 'transparent' }}>{t}</button>
        ))}
      </div>
      {tab === 'Overview' && <OverviewTab />}
      {tab === 'Invoices' && <InvoicesTab />}
      {tab === 'Expenses' && <ExpensesTab />}
    </DashboardShell>
  )
}
