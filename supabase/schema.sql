-- Nova Wave One — Supabase schema for Nova Audit and related tables.
-- (same project as nova-systems.app: xizmgruvuazmummotzkp). This assumes
-- nova_ai_agents, nova_ai_calls, nova_ai_knowledge_bases, nova_ai_voices, and
-- nova_ai_settings already exist (created by nova-systems-copy's schema-update.sql).
--
-- RUN THIS ENTIRE FILE IN THE SUPABASE SQL EDITOR BEFORE TESTING.
-- Safe to run multiple times — every statement is idempotent (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS nova_ai_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Every column nova_ai_audits needs, explicit — CREATE TABLE IF NOT EXISTS is a no-op against
-- a table that already exists, so a bare column list above is not enough to guarantee these
-- exist on a database that had an earlier, partial version of this table. This bit us once
-- already (phone_test_result/email_test_result/revenue_leak_breakdown silently never got added).
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS performance_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS google_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS phone_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS email_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS social_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS competitive_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS overall_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS score_label TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS revenue_leak_monthly NUMERIC;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS revenue_leak_annual NUMERIC;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS revenue_leak_breakdown JSONB;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS competitor_data JSONB;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS key_findings TEXT[];
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS pdf_data TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS pitch_deck_data TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS phone_test_result JSONB;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS email_test_result JSONB;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS google_rating NUMERIC;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS google_reviews INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS outreach_status TEXT DEFAULT 'pending';
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS consent BOOLEAN DEFAULT FALSE;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS consent_date TIMESTAMPTZ;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS consent_source TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS call_made_at TIMESTAMPTZ;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS meeting_booked BOOLEAN DEFAULT FALSE;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS became_client BOOLEAN DEFAULT FALSE;

-- 10-category rebuild (Nova Intelligence Report) — new columns.
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS brand_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS storefront_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS lead_capture_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS customer_experience_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS ai_readiness_score INTEGER;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS priority_roadmap JSONB;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'full';

CREATE TABLE IF NOT EXISTS nova_audit_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name TEXT,
  industry TEXT,
  city TEXT,
  total_companies INTEGER DEFAULT 0,
  audits_complete INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  responses INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  clients_closed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_ai_email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  direction TEXT,
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body TEXT,
  category TEXT,
  ai_draft TEXT,
  status TEXT DEFAULT 'needs_review',
  sent BOOLEAN DEFAULT FALSE,
  confidence_score NUMERIC,
  opened BOOLEAN DEFAULT FALSE,
  clicked BOOLEAN DEFAULT FALSE,
  replied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nova_ai_calls ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE nova_ai_calls ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'inbound';
ALTER TABLE nova_ai_calls ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE nova_ai_calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE nova_ai_calls ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE nova_ai_calls ADD COLUMN IF NOT EXISTS duration INTEGER;

-- ============================================================================================
-- WAVE ONE — Nova Blue SMS/WhatsApp, Nova Email review flow, Nova Voice call correlation,
-- Nova Social, Nova Revive, and cross-engine opt-out/lead-temperature tracking.
-- Safe to run multiple times — every statement below is idempotent.
-- ============================================================================================

CREATE TABLE IF NOT EXISTS nova_ai_social_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID,
  platform TEXT,
  event_type TEXT,
  from_user TEXT,
  message TEXT,
  ai_reply TEXT,
  post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_ai_revive_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID,
  channel TEXT,
  message TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nova Blue SMS / WhatsApp — platform discriminator and Twilio message SID for dedupe/lookup.
ALTER TABLE nova_ai_sms_logs ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'sms';
ALTER TABLE nova_ai_sms_logs ADD COLUMN IF NOT EXISTS message_sid TEXT;

-- Nova Voice — correlates a call record created at make_call/incoming-call time with the
-- Twilio status callback (call_completed) and the Render stream server's final transcript.
ALTER TABLE nova_ai_calls ADD COLUMN IF NOT EXISTS call_sid TEXT;

-- Nova Email — review queue + confidence gating for AI-drafted replies.
ALTER TABLE nova_ai_email_logs ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE nova_ai_email_logs ADD COLUMN IF NOT EXISTS auto_send BOOLEAN DEFAULT FALSE;
ALTER TABLE nova_ai_email_logs ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;

-- Nova Revive — lead lifecycle tracking on top of the existing outreach_status column.
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT FALSE;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS lead_temperature TEXT;
ALTER TABLE nova_ai_audits ADD COLUMN IF NOT EXISTS days_since_contact INTEGER;

-- Nova Social / Nova Voice — link an agent to its Meta account and Twilio number for webhook
-- and incoming-call routing.
ALTER TABLE nova_ai_agents ADD COLUMN IF NOT EXISTS meta_account_id TEXT;
ALTER TABLE nova_ai_agents ADD COLUMN IF NOT EXISTS twilio_number_sid TEXT;

-- ============================================================================================
-- WAVE ONE — 21 ENGINES / 5 DEPARTMENTS EXPANSION
-- Shared systems (CRM, Memory, Knowledge, Flow, Insights) plus one table per new engine.
-- Safe to run multiple times — every statement below is idempotent.
-- ============================================================================================

-- ── Nova Knowledge — new sections on the existing per-agent knowledge base table. ───────────
-- (nova_ai_knowledge_bases itself is defined in nova-systems-copy's schema, not here — these
-- ALTERs are additive and safe whether or not this exact column set already exists.)
ALTER TABLE nova_ai_knowledge_bases ADD COLUMN IF NOT EXISTS staff JSONB;
ALTER TABLE nova_ai_knowledge_bases ADD COLUMN IF NOT EXISTS policies TEXT;
ALTER TABLE nova_ai_knowledge_bases ADD COLUMN IF NOT EXISTS tone TEXT;
ALTER TABLE nova_ai_knowledge_bases ADD COLUMN IF NOT EXISTS competitors TEXT;
ALTER TABLE nova_ai_knowledge_bases ADD COLUMN IF NOT EXISTS pricing TEXT;

-- ── Nova CRM — the central contact/activity/deal brain every engine reads and writes. ───────

CREATE TABLE IF NOT EXISTS nova_crm_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  city TEXT,
  industry TEXT,
  source TEXT,
  status TEXT DEFAULT 'cold_lead',
  lead_score INTEGER DEFAULT 0,
  deal_value NUMERIC DEFAULT 0,
  notes TEXT,
  audit_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nova_crm_contacts_phone_idx ON nova_crm_contacts (phone);
CREATE INDEX IF NOT EXISTS nova_crm_contacts_email_idx ON nova_crm_contacts (email);
CREATE INDEX IF NOT EXISTS nova_crm_contacts_status_idx ON nova_crm_contacts (status);

CREATE TABLE IF NOT EXISTS nova_crm_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES nova_crm_contacts(id) ON DELETE CASCADE,
  engine TEXT,
  direction TEXT,
  summary TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nova_crm_activities_contact_idx ON nova_crm_activities (contact_id);

CREATE TABLE IF NOT EXISTS nova_crm_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES nova_crm_contacts(id) ON DELETE CASCADE,
  title TEXT,
  stage TEXT DEFAULT 'prospect',
  value NUMERIC DEFAULT 0,
  probability INTEGER DEFAULT 0,
  expected_close DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nova_crm_deals_contact_idx ON nova_crm_deals (contact_id);

-- ── Nova Memory — permanent per-contact personalization layer. ──────────────────────────────

CREATE TABLE IF NOT EXISTS nova_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID,
  contact_phone TEXT,
  contact_email TEXT,
  preferred_language TEXT DEFAULT 'en',
  preferred_channel TEXT DEFAULT 'sms',
  best_time_to_contact TEXT,
  topics_discussed TEXT[],
  sentiment TEXT DEFAULT 'neutral',
  last_topic_discussed TEXT,
  purchase_history JSONB,
  appointment_history JSONB,
  appointment_count INTEGER DEFAULT 0,
  response_rate NUMERIC DEFAULT 0,
  special_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nova_memory_contact_idx ON nova_memory (contact_id);
CREATE INDEX IF NOT EXISTS nova_memory_phone_idx ON nova_memory (contact_phone);
CREATE INDEX IF NOT EXISTS nova_memory_email_idx ON nova_memory (contact_email);

-- ── Nova Book — native booking system (no external Cal.com dependency). ─────────────────────

CREATE TABLE IF NOT EXISTS nova_book_meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  meeting_type TEXT,
  meeting_date DATE,
  meeting_time TEXT,
  status TEXT DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Finances — invoicing, MRR, expenses. ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_finances_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT,
  client_email TEXT,
  services JSONB,
  subtotal NUMERIC,
  tax NUMERIC DEFAULT 0,
  total NUMERIC,
  due_date DATE,
  status TEXT DEFAULT 'unpaid',
  stripe_payment_link TEXT,
  stripe_payment_intent TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_finances_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT,
  description TEXT,
  amount NUMERIC,
  date DATE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Flow — workflow automation connecting every engine. ────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_flow_workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  trigger_type TEXT,
  trigger_conditions JSONB,
  actions JSONB,
  active BOOLEAN DEFAULT TRUE,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_flow_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID,
  contact_id UUID,
  status TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── Nova Tron — world intelligence engine. ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_tron_trends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connecticut_opportunities JSONB,
  ai_developments JSONB,
  content_ideas JSONB,
  alerts JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Additional real signal categories so Tron (Intelligence) can fan out to every engine, not just
-- Media/Isaac's morning brief — see api/nova-tron/index.js and api/_recommendations.js.
ALTER TABLE nova_tron_trends ADD COLUMN IF NOT EXISTS pricing_signals JSONB;
ALTER TABLE nova_tron_trends ADD COLUMN IF NOT EXISTS compliance_signals JSONB;
ALTER TABLE nova_tron_trends ADD COLUMN IF NOT EXISTS reputation_signals JSONB;
ALTER TABLE nova_tron_trends ADD COLUMN IF NOT EXISTS seasonal_demand_signals JSONB;
ALTER TABLE nova_tron_trends ADD COLUMN IF NOT EXISTS reactivation_opportunities JSONB;

-- ── Nova Social — scheduled post publishing (in addition to the existing DM/comment log). ──

CREATE TABLE IF NOT EXISTS nova_social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT,
  content TEXT,
  media_url TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled',
  engagement JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Reviews — reputation management. ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID,
  place_id TEXT,
  platform TEXT DEFAULT 'google',
  reviewer_name TEXT,
  rating INTEGER,
  review_text TEXT,
  ai_response TEXT,
  response_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Insights — executive AI advisor. ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_insights_briefings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_text TEXT,
  briefing_type TEXT DEFAULT 'daily',
  stats_snapshot JSONB,
  anomalies JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Media — AI-generated creative assets. ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_media_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT,
  title TEXT,
  content TEXT,
  image_url TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Hire — recruiting. ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_hire_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  cover_letter TEXT,
  portfolio_url TEXT,
  resume_url TEXT,
  ai_score INTEGER,
  ai_summary TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Client — self-service client portal accounts. ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_client_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  crm_contact_id UUID,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_client_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_account_id UUID REFERENCES nova_client_accounts(id) ON DELETE CASCADE,
  direction TEXT,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_client_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_account_id UUID REFERENCES nova_client_accounts(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Law — contracts, e-signatures, licenses. ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nova_law_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID,
  contract_type TEXT,
  content TEXT,
  signed BOOLEAN DEFAULT FALSE,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nova_law_licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_name TEXT,
  issuing_authority TEXT,
  license_number TEXT,
  expiry_date DATE,
  status TEXT DEFAULT 'active',
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Docs — generated document library (pitch decks, proposals, contracts). ─────────────

CREATE TABLE IF NOT EXISTS nova_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID,
  document_type TEXT,
  title TEXT,
  file_data TEXT,
  share_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nova Tax — receipts on top of nova_finances_expenses. ────────────────────────────────────

ALTER TABLE nova_finances_expenses ADD COLUMN IF NOT EXISTS tax_category TEXT;

CREATE TABLE IF NOT EXISTS nova_tax_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  due_date DATE,
  category TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================================
-- WAVE ONE — FOUNDATIONAL CROSS-ENGINE LAYER ("no engine is an island")
-- Shared primitives every engine uses: recommendations, tasks, and Flow's real delayed-step
-- queue. Safe to run multiple times — every statement below is idempotent.
-- ============================================================================================

-- ── Nova Recommendations — any engine can surface a real, actionable finding to any other. ──
-- Every row must have a `resolution` (automation/task/content/crm_update/notify) — enforced in
-- code (api/_recommendations.js), not just here — so a recommendation can never be "just stored
-- and displayed," per the governing rule.

CREATE TABLE IF NOT EXISTS nova_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engine TEXT,
  source_engines TEXT[],
  message TEXT,
  recommended_action TEXT,
  estimated_value NUMERIC,
  is_measured BOOLEAN DEFAULT FALSE,
  confidence NUMERIC,
  evidence JSONB,
  resolution TEXT,
  contact_id UUID,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS nova_recommendations_engine_idx ON nova_recommendations (engine);
CREATE INDEX IF NOT EXISTS nova_recommendations_status_idx ON nova_recommendations (status);

-- ── Nova Tasks — approve-to-execute primitive layered on Nova Flow. ─────────────────────────

CREATE TABLE IF NOT EXISTS nova_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engine TEXT,
  title TEXT,
  description TEXT,
  contact_id UUID,
  source_recommendation_id UUID,
  assigned_to TEXT,
  trigger_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS nova_tasks_status_idx ON nova_tasks (status);
CREATE INDEX IF NOT EXISTS nova_tasks_contact_idx ON nova_tasks (contact_id);

-- ── Nova Flow — real delayed-step queue, fixing `wait` (previously logged but never delayed). ─
-- When a workflow hits a `wait` step, the remaining actions are saved here with a real
-- resume_at timestamp instead of continuing immediately; a cron picks them back up.

CREATE TABLE IF NOT EXISTS nova_flow_pending_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID,
  contact_snapshot JSONB,
  remaining_actions JSONB,
  resume_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nova_flow_pending_steps_status_idx ON nova_flow_pending_steps (status, resume_at);

-- ── Nova Memory — lifetime value, so "One AI Memory" includes real spend history. ───────────
ALTER TABLE nova_memory ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC DEFAULT 0;
