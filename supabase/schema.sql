-- Nova Wave One — additional tables, run in the Nova Systems Supabase SQL Editor
-- (same project as nova-systems.app: xizmgruvuazmummotzkp). This assumes
-- nova_ai_agents, nova_ai_calls, nova_ai_knowledge_bases, nova_ai_voices, and
-- nova_ai_settings already exist (created by nova-systems-copy's schema-update.sql).

CREATE TABLE IF NOT EXISTS nova_ai_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  owner_name TEXT,
  city TEXT,
  industry TEXT,
  performance_score INTEGER,
  google_score INTEGER,
  phone_score INTEGER,
  email_score INTEGER,
  social_score INTEGER,
  competitive_score INTEGER,
  overall_score INTEGER,
  score_label TEXT,
  revenue_leak_monthly NUMERIC,
  revenue_leak_annual NUMERIC,
  revenue_leak_breakdown JSONB,
  competitor_data JSONB,
  key_findings TEXT[],
  pdf_data TEXT,
  pitch_deck_data TEXT,
  phone_test_result JSONB,
  email_test_result JSONB,
  google_rating NUMERIC,
  google_reviews INTEGER,
  outreach_status TEXT DEFAULT 'pending',
  consent BOOLEAN DEFAULT FALSE,
  consent_date TIMESTAMPTZ,
  consent_source TEXT,
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  call_made_at TIMESTAMPTZ,
  meeting_booked BOOLEAN DEFAULT FALSE,
  became_client BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
