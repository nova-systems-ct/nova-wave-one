import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Logs from './pages/Logs'

import AuditHome from './pages/audit/AuditHome'
import AuditResult from './pages/audit/AuditResult'
import AuditReports from './pages/audit/AuditReports'

import VoiceHome from './pages/voice/VoiceHome'
import VoiceLogs from './pages/voice/VoiceLogs'

import SMSHome from './pages/sms/SMSHome'
import SMSConversations from './pages/sms/SMSConversations'

import WhatsAppHome from './pages/whatsapp/WhatsAppHome'

import EmailHome from './pages/email/EmailHome'
import EmailInbox from './pages/email/EmailInbox'
import EmailCampaigns from './pages/email/EmailCampaigns'

import SocialHome from './pages/social/SocialHome'
import SocialInbox from './pages/social/SocialInbox'

import ReviveHome from './pages/revive/ReviveHome'
import ReviveCampaigns from './pages/revive/ReviveCampaigns'

import UnifiedInbox from './pages/inbox/UnifiedInbox'

import AgentList from './pages/agents/AgentList'
import AgentCreate from './pages/agents/AgentCreate'
import AgentDetail from './pages/agents/AgentDetail'
import KnowledgeBases from './pages/agents/KnowledgeBases'
import Voices from './pages/agents/Voices'

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080808', color: '#666666' }}>
      <p className="text-sm">Page not found.</p>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/dashboard/audit" element={<AuditHome />} />
        <Route path="/dashboard/audit/result/:id" element={<AuditResult />} />
        <Route path="/dashboard/audit/reports" element={<AuditReports />} />

        <Route path="/dashboard/voice" element={<VoiceHome />} />
        <Route path="/dashboard/voice/logs" element={<VoiceLogs />} />

        <Route path="/dashboard/sms" element={<SMSHome />} />
        <Route path="/dashboard/sms/conversations" element={<SMSConversations />} />

        <Route path="/dashboard/whatsapp" element={<WhatsAppHome />} />

        <Route path="/dashboard/email" element={<EmailHome />} />
        <Route path="/dashboard/email/inbox" element={<EmailInbox />} />
        <Route path="/dashboard/email/campaigns" element={<EmailCampaigns />} />

        <Route path="/dashboard/social" element={<SocialHome />} />
        <Route path="/dashboard/social/inbox" element={<SocialInbox />} />

        <Route path="/dashboard/revive" element={<ReviveHome />} />
        <Route path="/dashboard/revive/campaigns" element={<ReviveCampaigns />} />

        <Route path="/dashboard/inbox" element={<UnifiedInbox />} />

        <Route path="/dashboard/agents" element={<AgentList />} />
        <Route path="/dashboard/agents/create" element={<AgentCreate />} />
        <Route path="/dashboard/agents/knowledge-bases" element={<KnowledgeBases />} />
        <Route path="/dashboard/agents/voices" element={<Voices />} />
        <Route path="/dashboard/agents/:id" element={<AgentDetail />} />

        <Route path="/dashboard/settings" element={<Settings />} />
        <Route path="/dashboard/logs" element={<Logs />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App
