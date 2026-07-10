// Thin fetch wrapper for this app's own /api routes.
async function request(path, { method = 'GET', body, params } = {}) {
  let url = path
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += (path.includes('?') ? '&' : '?') + qs
  }
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export const api = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body) => request(path, { method: 'POST', body }),
}

export const AuditAPI = {
  run: (payload) => api.post('/api/nova-audit?action=run_audit', payload),
  list: (params) => api.get('/api/nova-audit', { action: 'get_audits', ...params }),
  get: (id) => api.get('/api/nova-audit', { action: 'get_audit', id }),
  updateStatus: (payload) => api.post('/api/nova-audit?action=update_audit_status', payload),
  resend: (id) => api.post('/api/nova-audit?action=resend', { id }),
  bulkScan: (payload) => api.post('/api/nova-audit?action=bulk_scan', payload),
  runBulk: (payload) => api.post('/api/nova-audit?action=run_bulk_audits', payload),
}

export const EmailAPI = {
  list: (params) => api.get('/api/nova-email', { action: 'get_emails', ...params }),
  sendOutbound: (payload) => api.post('/api/nova-email?action=send_outbound', payload),
  sendCampaign: (payload) => api.post('/api/nova-email?action=send_campaign', payload),
  updateStatus: (payload) => api.post('/api/nova-email?action=update_email_status', payload),
}
