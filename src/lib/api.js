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
  send: (payload) => api.post('/api/nova-email?action=send_email', payload),
  sendOutbound: (payload) => api.post('/api/nova-email?action=send_email', payload),
  sendCampaign: (payload) => api.post('/api/nova-email?action=send_campaign', payload),
  generateReply: (payload) => api.post('/api/nova-email?action=generate_reply', payload),
  approveSend: (payload) => api.post('/api/nova-email?action=approve_send', payload),
  dailySummary: () => api.post('/api/nova-email?action=daily_summary', {}),
  updateStatus: (payload) => api.post('/api/nova-email?action=update_email_status', payload),
}

export const SMSAPI = {
  send: (payload) => api.post('/api/nova-sms?action=send_sms', payload),
  sendCampaign: (payload) => api.post('/api/nova-sms?action=send_campaign', payload),
  getConversations: () => api.get('/api/nova-sms', { action: 'get_conversations' }),
  getConversation: (contact_phone) => api.get('/api/nova-sms', { action: 'get_conversation', contact_phone }),
  checkColdLeads: () => api.post('/api/nova-sms?action=check_cold_leads', {}),
  sendWhatsapp: (payload) => api.post('/api/nova-sms?action=send_whatsapp', payload),
  sendWhatsappCampaign: (payload) => api.post('/api/nova-sms?action=send_whatsapp_campaign', payload),
}

export const VoiceAPI = {
  makeCall: (payload) => api.post('/api/nova-voice?action=make_call', payload),
  getCalls: (params) => api.get('/api/nova-voice', { action: 'get_calls', ...params }),
  getAgents: () => api.get('/api/nova-voice', { action: 'get_agents' }),
  renderStatus: () => api.get('/api/nova-voice', { action: 'render_status' }),
}

export const SocialAPI = {
  getLogs: (params) => api.get('/api/nova-social', { action: 'get_social_logs', ...params }),
  setupStatus: () => api.get('/api/nova-social', { action: 'setup_status' }),
}

export const ReviveAPI = {
  checkAllLeads: () => api.post('/api/nova-revive?action=check_all_leads', {}),
  getColdLeads: () => api.get('/api/nova-revive', { action: 'get_cold_leads' }),
  runCampaign: (payload) => api.post('/api/nova-revive?action=run_campaign', payload),
  optOutLead: (payload) => api.post('/api/nova-revive?action=opt_out_lead', payload),
  getLogs: (params) => api.get('/api/nova-revive', { action: 'get_revive_logs', ...params }),
}
