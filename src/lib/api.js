import { supabase } from './supabase'

// Thin fetch wrapper for this app's own /api routes.
async function request(path, { method = 'GET', body, params, authed = false } = {}) {
  let url = path
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += (path.includes('?') ? '&' : '?') + qs
  }
  const headers = body ? { 'Content-Type': 'application/json' } : {}
  if (authed) {
    const { data } = supabase ? await supabase.auth.getSession() : { data: null }
    const token = data?.session?.access_token
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export const api = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body) => request(path, { method: 'POST', body }),
}

// Settings touch live third-party credentials — every call carries the caller's Supabase
// session token, and the backend rejects anything without a currently-valid one.
export const AuthAPI = {
  getSettings: () => request('/api/auth', { method: 'GET', params: { action: 'get_settings' }, authed: true }),
  setSettings: (payload) => request('/api/auth?action=set_settings', { method: 'POST', body: payload, authed: true }),
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
  schedulePost: (payload) => api.post('/api/nova-social?action=schedule_post', payload),
  getScheduled: () => api.get('/api/nova-social', { action: 'get_scheduled' }),
  publishPost: (payload) => api.post('/api/nova-social?action=publish_post', payload),
  getAnalytics: () => api.get('/api/nova-social', { action: 'get_analytics' }),
}

export const ReviveAPI = {
  checkAllLeads: () => api.post('/api/nova-revive?action=check_all_leads', {}),
  getColdLeads: () => api.get('/api/nova-revive', { action: 'get_cold_leads' }),
  runCampaign: (payload) => api.post('/api/nova-revive?action=run_campaign', payload),
  optOutLead: (payload) => api.post('/api/nova-revive?action=opt_out_lead', payload),
  getLogs: (params) => api.get('/api/nova-revive', { action: 'get_revive_logs', ...params }),
}

export const CRMAPI = {
  createContact: (payload) => api.post('/api/nova-crm?action=create_contact', payload),
  updateContact: (payload) => api.post('/api/nova-crm?action=update_contact', payload),
  getContact: (id) => api.get('/api/nova-crm', { action: 'get_contact', id }),
  getContacts: (params) => api.get('/api/nova-crm', { action: 'get_contacts', ...params }),
  logActivity: (payload) => api.post('/api/nova-crm?action=log_activity', payload),
  createDeal: (payload) => api.post('/api/nova-crm?action=create_deal', payload),
  updateDeal: (payload) => api.post('/api/nova-crm?action=update_deal', payload),
  getPipeline: () => api.get('/api/nova-crm', { action: 'get_pipeline' }),
  getAlerts: () => api.get('/api/nova-crm', { action: 'get_alerts' }),
}

export const KnowledgeAPI = {
  getKnowledge: (agent_id) => api.get('/api/nova-knowledge', { action: 'get_knowledge', agent_id }),
  updateSection: (payload) => api.post('/api/nova-knowledge?action=update_section', payload),
  scrapeUrl: (payload) => api.post('/api/nova-knowledge?action=scrape_url', payload),
  uploadPdf: (payload) => api.post('/api/nova-knowledge?action=upload_pdf', payload),
  getSystemPrompt: (agent_id) => api.get('/api/nova-knowledge', { action: 'get_system_prompt', agent_id }),
}

export const InsightsAPI = {
  generateBriefing: () => api.post('/api/nova-insights?action=generate_briefing', {}),
  getStats: () => api.get('/api/nova-insights', { action: 'get_stats' }),
  getAnomalies: () => api.get('/api/nova-insights', { action: 'get_anomalies' }),
  generateWeeklyReport: () => api.post('/api/nova-insights?action=generate_weekly_report', {}),
}

export const BookAPI = {
  createMeeting: (payload) => api.post('/api/nova-book?action=create_meeting', payload),
  getMeetings: (params) => api.get('/api/nova-book', { action: 'get_meetings', ...params }),
  cancelMeeting: (payload) => api.post('/api/nova-book?action=cancel_meeting', payload),
  rescheduleMeeting: (payload) => api.post('/api/nova-book?action=reschedule_meeting', payload),
  getAvailability: (params) => api.get('/api/nova-book', { action: 'get_availability', ...params }),
}

export const SalesAPI = {
  scoreLead: (payload) => api.post('/api/nova-sales?action=score_lead', payload),
  getProspects: () => api.get('/api/nova-sales', { action: 'get_prospects' }),
  generateProposal: (payload) => api.post('/api/nova-sales?action=generate_proposal', payload),
  logCall: (payload) => api.post('/api/nova-sales?action=log_call', payload),
  getCoaching: () => api.get('/api/nova-sales', { action: 'get_coaching' }),
}

export const FlowAPI = {
  getWorkflows: () => api.get('/api/nova-flow', { action: 'get_workflows' }),
  createWorkflow: (payload) => api.post('/api/nova-flow?action=create_workflow', payload),
  toggleWorkflow: (payload) => api.post('/api/nova-flow?action=toggle_workflow', payload),
  getRuns: (params) => api.get('/api/nova-flow', { action: 'get_runs', ...params }),
}

export const TronAPI = {
  runAnalysis: () => api.post('/api/nova-tron?action=run_analysis', {}),
  getLatest: () => api.get('/api/nova-tron', { action: 'get_latest' }),
}

export const FinancesAPI = {
  createInvoice: (payload) => api.post('/api/nova-finances?action=create_invoice', payload),
  getInvoices: (params) => api.get('/api/nova-finances', { action: 'get_invoices', ...params }),
  updateInvoiceStatus: (payload) => api.post('/api/nova-finances?action=update_invoice_status', payload),
  createExpense: (payload) => api.post('/api/nova-finances?action=create_expense', payload),
  getExpenses: (params) => api.get('/api/nova-finances', { action: 'get_expenses', ...params }),
  getMrr: () => api.get('/api/nova-finances', { action: 'get_mrr' }),
  getProfit: () => api.get('/api/nova-finances', { action: 'get_profit' }),
}

export const TaxAPI = {
  getExpenseSummary: (params) => api.get('/api/nova-tax', { action: 'get_expense_summary', ...params }),
  getCalendar: () => api.get('/api/nova-tax', { action: 'get_calendar' }),
  generateReport: (payload) => api.post('/api/nova-tax?action=generate_report', payload),
}

export const LawAPI = {
  createContract: (payload) => api.post('/api/nova-law?action=create_contract', payload),
  signContract: (payload) => api.post('/api/nova-law?action=sign_contract', payload),
  getContracts: () => api.get('/api/nova-law', { action: 'get_contracts' }),
  getLicenses: () => api.get('/api/nova-law', { action: 'get_licenses' }),
  getCompliance: () => api.get('/api/nova-law', { action: 'get_compliance' }),
}

export const HireAPI = {
  createPosting: (payload) => api.post('/api/nova-hire?action=create_posting', payload),
  getApplications: () => api.get('/api/nova-hire', { action: 'get_applications' }),
  submitApplication: (payload) => api.post('/api/nova-hire?action=submit_application', payload),
  screenApplication: (payload) => api.post('/api/nova-hire?action=screen_application', payload),
  createOnboarding: (payload) => api.post('/api/nova-hire?action=create_onboarding', payload),
}

export const DocsAPI = {
  generatePitchDeck: (payload) => api.post('/api/nova-docs?action=generate_pitch_deck', payload),
  generateProposal: (payload) => api.post('/api/nova-docs?action=generate_proposal', payload),
  getDocuments: () => api.get('/api/nova-docs', { action: 'get_documents' }),
}

export const MediaAPI = {
  generateCaption: (payload) => api.post('/api/nova-media?action=generate_caption', payload),
  generateCalendar: (payload) => api.post('/api/nova-media?action=generate_calendar', payload),
  getAssets: () => api.get('/api/nova-media', { action: 'get_assets' }),
}

export const ClientAPI = {
  login: (payload) => api.post('/api/nova-client?action=login', payload),
  getClientData: (id) => api.get('/api/nova-client', { action: 'get_client_data', id }),
  getInvoices: (email) => api.get('/api/nova-client', { action: 'get_invoices', email }),
  getMessages: (client_account_id) => api.get('/api/nova-client', { action: 'get_messages', client_account_id }),
  sendMessage: (payload) => api.post('/api/nova-client?action=send_message', payload),
  getFiles: (client_account_id) => api.get('/api/nova-client', { action: 'get_files', client_account_id }),
  uploadFile: (payload) => api.post('/api/nova-client?action=upload_file', payload),
}

export const ReviewsAPI = {
  fetchReviews: () => api.post('/api/nova-reviews?action=fetch_reviews', {}),
  getReviews: (params) => api.get('/api/nova-reviews', { action: 'get_reviews', ...params }),
  generateResponse: (payload) => api.post('/api/nova-reviews?action=generate_response', payload),
  sendResponse: (payload) => api.post('/api/nova-reviews?action=send_response', payload),
  requestReview: (payload) => api.post('/api/nova-reviews?action=request_review', payload),
}
