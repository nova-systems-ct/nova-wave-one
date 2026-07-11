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
