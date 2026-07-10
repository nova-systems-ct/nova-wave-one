import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Search, Layers, ListChecks, DollarSign, Map } from 'lucide-react'
import DashboardShell from '../../components/DashboardShell'
import { CT_CITIES, INDUSTRIES } from '../../lib/constants'
import { AuditAPI } from '../../lib/api'

const GOLD = '#C8A96E'

const STEPS = [
  { label: 'Scanning website performance…', eta: '~10s' },
  { label: 'Analyzing Google Business presence…', eta: '~8s' },
  { label: 'Testing phone responsiveness…', eta: '~15s' },
  { label: 'Testing email response…', eta: '~5s' },
  { label: 'Scanning social media presence…', eta: '~8s' },
  { label: 'Discovering top competitors…', eta: '~10s' },
  { label: 'Calculating revenue leaks…', eta: '~1s' },
  { label: 'Building your audit report…', eta: '~5s' },
  { label: 'Preparing pitch deck…', eta: '~5s' },
  { label: 'Delivering report…', eta: '~3s' },
]

const inputStyle = { width: '100%', padding: '11px 14px', background: '#080808', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }
const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666666', marginBottom: 7 }

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <p className="text-[11px] mt-1.5" style={{ color: '#666666' }}>{hint}</p>}
    </div>
  )
}

const emptyForm = { business_name: '', website_url: '', phone: '', email: '', owner_name: '', city: '', industry: '' }

export default function AuditHome() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [running, setRunning] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState('')
  const [showBulk, setShowBulk] = useState(false)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const runAudit = async (e) => {
    e.preventDefault()
    if (!form.business_name.trim() || !form.city || !form.industry) {
      setError('Business name, city, and industry are required.')
      return
    }
    setError('')
    setRunning(true)
    setStepIndex(0)

    // The audit is a single real API call — these steps aren't separately awaited, they just
    // advance at realistic intervals (8-12s each) while that one call is actually running, and
    // stop advancing once they reach the last step rather than faking completion early.
    let cancelled = false
    const scheduleNextStep = (i) => {
      if (cancelled || i >= STEPS.length - 1) return
      const delay = 8000 + Math.random() * 4000
      setTimeout(() => {
        if (cancelled) return
        setStepIndex(i + 1)
        scheduleNextStep(i + 1)
      }, delay)
    }
    scheduleNextStep(0)

    try {
      const result = await AuditAPI.run(form)
      cancelled = true
      setStepIndex(STEPS.length)
      setTimeout(() => navigate(`/dashboard/audit/result/${result.audit_id}`), 500)
    } catch (err) {
      cancelled = true
      setRunning(false)
      setError(err.message || 'Audit failed — please try again.')
    }
  }

  return (
    <DashboardShell title="Nova Audit">
      {!running ? (
        <>
          <div className="max-w-2xl mb-6">
            <h2 className="text-3xl font-bold text-white mb-3 leading-tight">Find Every Place Your Business Is Losing Customers.</h2>
            <p className="text-sm leading-relaxed" style={{ color: '#999999' }}>
              Nova Audit is a complete business intelligence scan. In 90 seconds we identify every revenue leak, every missed opportunity, and every gap your competitors are exploiting. Then we show you exactly how to fix it.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 mb-8">
            {[
              { icon: ListChecks, label: '10 Audit Categories' },
              { icon: DollarSign, label: 'Real Revenue Numbers' },
              { icon: Map, label: 'Priority Roadmap' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: GOLD }} />
                <span className="text-xs font-semibold" style={{ color: '#999999' }}>{label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="max-w-2xl mb-5 px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <form onSubmit={runAudit} className="max-w-2xl rounded-xl p-8 mb-6" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
            <Field label="Business Name *">
              <input style={inputStyle} value={form.business_name} onChange={(e) => set({ business_name: e.target.value })} />
            </Field>
            <Field label="Website URL" hint="Leave blank if they have no website.">
              <input style={inputStyle} value={form.website_url} onChange={(e) => set({ website_url: e.target.value })} placeholder="yourbusiness.com" />
            </Field>
            <Field label="Phone Number" hint="We will test their call response.">
              <input style={inputStyle} value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(203) 000-0000" />
            </Field>
            <Field label="Email Address" hint="We will test their email response.">
              <input style={inputStyle} value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="contact@business.com" />
            </Field>
            <Field label="Owner Name">
              <input style={inputStyle} value={form.owner_name} onChange={(e) => set({ owner_name: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="City *">
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.city} onChange={(e) => set({ city: e.target.value })}>
                  <option value="">Select a city</option>
                  {CT_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Industry *">
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
                  <option value="">Select an industry</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
            </div>

            <button type="submit" className="w-full mt-3 py-4 text-xs font-bold tracking-[0.2em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808' }}>
              Run My Free Business Audit
            </button>
          </form>

          <p className="max-w-2xl text-xs mb-6" style={{ color: '#666666' }}>No credit card. No commitment. Just answers.</p>

          <button
            onClick={() => setShowBulk((v) => !v)}
            className="flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-bold tracking-[0.1em] uppercase transition-colors"
            style={{ border: `1px solid ${GOLD}50`, color: GOLD, background: 'transparent' }}
          >
            <Layers className="w-3.5 h-3.5" /> Bulk Scan — Find Companies Automatically
          </button>

          {showBulk && <BulkScanPanel />}
        </>
      ) : (
        <div className="max-w-2xl rounded-xl p-10" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
          <div className="flex items-center gap-3 mb-2">
            <Search className="w-5 h-5" style={{ color: GOLD }} />
            <h2 className="text-lg font-bold text-white">Running audit on {form.business_name}</h2>
          </div>
          <p className="text-xs mb-8" style={{ color: '#666666' }}>Estimated total time: 45 to 90 seconds.</p>

          <div style={{ height: 3, background: '#2A2A2A', borderRadius: 3, marginBottom: 32 }}>
            <div style={{ height: '100%', width: `${((stepIndex + 1) / STEPS.length) * 100}%`, background: GOLD, borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>

          <div className="space-y-4">
            {STEPS.map((s, i) => {
              const done = i < stepIndex
              const active = i === stepIndex
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: done ? GOLD : 'transparent', border: `1.5px solid ${done || active ? GOLD : '#2A2A2A'}` }}
                  >
                    {done && <Check className="w-3 h-3" style={{ color: '#080808' }} />}
                  </div>
                  <span className="text-sm flex-1" style={{ color: done ? '#fff' : active ? '#fff' : '#666666' }}>{s.label}</span>
                  <span className="text-[11px]" style={{ color: '#666666' }}>{s.eta}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </DashboardShell>
  )
}

function BulkScanPanel() {
  const [industry, setIndustry] = useState(INDUSTRIES[0])
  const [city, setCity] = useState(CT_CITIES[0])
  const [maxResults, setMaxResults] = useState(30)
  const [scanning, setScanning] = useState(false)
  const [found, setFound] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const scan = async () => {
    setScanning(true)
    setError('')
    setFound([])
    try {
      const data = await AuditAPI.bulkScan({ industry, city, max_results: maxResults })
      const results = Array.isArray(data?.companies) ? data.companies : []
      setFound(results)
      setSelected(new Set(results.map((_, i) => i)))
    } catch (err) {
      setError(err.message || 'Scan failed.')
    }
    setScanning(false)
  }

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const runSelected = async () => {
    const companies = found.filter((_, i) => selected.has(i))
    if (!companies.length) return
    setRunning(true)
    setProgress({ done: 0, total: companies.length })
    try {
      await AuditAPI.runBulk({ companies, industry, city })
      setProgress({ done: companies.length, total: companies.length })
    } catch (err) {
      setError(err.message || 'Bulk audit failed.')
    }
    setRunning(false)
  }

  return (
    <div className="max-w-2xl mt-5 rounded-xl p-8" style={{ background: '#0E0E0E', border: '1px solid #2A2A2A' }}>
      {error && <p className="text-xs mb-4" style={{ color: '#f87171' }}>{error}</p>}
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Field label="Industry">
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="City">
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={city} onChange={(e) => setCity(e.target.value)}>
            {CT_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={`Max Results — ${maxResults}`}>
          <input type="range" min="10" max="100" step="5" value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} style={{ width: '100%', accentColor: GOLD }} />
        </Field>
      </div>
      <button onClick={scan} disabled={scanning} className="px-6 py-2.5 text-xs font-bold tracking-[0.1em] uppercase rounded-lg mb-6" style={{ background: GOLD, color: '#080808', opacity: scanning ? 0.6 : 1 }}>
        {scanning ? 'Scanning…' : 'Scan'}
      </button>

      {found.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color: '#999999' }}>{found.length} businesses found · {selected.size} selected</p>
            <button onClick={() => setSelected(new Set(found.map((_, i) => i)))} className="text-[11px] font-bold uppercase" style={{ color: GOLD }}>Select All</button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg mb-5" style={{ border: '1px solid #2A2A2A' }}>
            {found.map((c, i) => (
              <label key={i} className="flex items-center gap-3 px-4 py-3 text-sm cursor-pointer" style={{ borderBottom: i < found.length - 1 ? '1px solid #2A2A2A' : 'none' }}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ accentColor: GOLD }} />
                <div className="flex-1">
                  <p style={{ color: '#fff' }}>{c.name}</p>
                  <p className="text-[11px]" style={{ color: '#666666' }}>{c.address} {c.google_rating ? `· ${c.google_rating}★` : ''}</p>
                </div>
              </label>
            ))}
          </div>
          {!running ? (
            <button onClick={runSelected} disabled={!selected.size} className="w-full py-3.5 text-xs font-bold tracking-[0.2em] uppercase rounded-lg" style={{ background: GOLD, color: '#080808', opacity: selected.size ? 1 : 0.5 }}>
              Run Audits on Selected
            </button>
          ) : (
            <p className="text-sm text-center" style={{ color: GOLD }}>{progress.done} of {progress.total} complete…</p>
          )}
        </>
      )}
    </div>
  )
}
