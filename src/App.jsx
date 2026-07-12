import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Logs from './pages/Logs'

import AuditHome from './pages/audit/AuditHome'
import AuditResult from './pages/audit/AuditResult'
import AuditReports from './pages/audit/AuditReports'

import VoiceHome from './pages/voice/VoiceHome'

import SMSHome from './pages/sms/SMSHome'

import WhatsAppHome from './pages/whatsapp/WhatsAppHome'

import EmailHome from './pages/email/EmailHome'
import EmailInbox from './pages/email/EmailInbox'
import EmailCampaigns from './pages/email/EmailCampaigns'

import SocialHome from './pages/social/SocialHome'

import ReviveHome from './pages/revive/ReviveHome'

import UnifiedInbox from './pages/inbox/UnifiedInbox'

import AgentList from './pages/agents/AgentList'
import AgentCreate from './pages/agents/AgentCreate'
import AgentDetail from './pages/agents/AgentDetail'
import Voices from './pages/agents/Voices'

import CRMPipeline from './pages/crm/CRMPipeline'
import CRMContacts from './pages/crm/CRMContacts'
import CRMContactDetail from './pages/crm/CRMContactDetail'

import KnowledgeHome from './pages/knowledge/KnowledgeHome'

import InsightsHome from './pages/insights/InsightsHome'

import BookHome from './pages/book/BookHome'
import PublicBook from './pages/PublicBook'

import FlowHome from './pages/flow/FlowHome'
import SalesHome from './pages/sales/SalesHome'
import TronHome from './pages/tron/TronHome'
import FinancesHome from './pages/finances/FinancesHome'
import ReviewsHome from './pages/reviews/ReviewsHome'
import MediaHome from './pages/media/MediaHome'
import TaxHome from './pages/tax/TaxHome'
import LawHome from './pages/law/LawHome'
import HireHome from './pages/hire/HireHome'
import PublicCareersApply from './pages/PublicCareersApply'
import ClientLogin from './pages/client/ClientLogin'
import ClientDashboard from './pages/client/ClientDashboard'
import ClientPortalAdmin from './pages/client/ClientPortalAdmin'
import DocsHome from './pages/docs/DocsHome'
import ShieldHome from './pages/shield/ShieldHome'

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
        <Route path="/book" element={<ErrorBoundary><PublicBook /></ErrorBoundary>} />
        <Route path="/careers/apply" element={<ErrorBoundary><PublicCareersApply /></ErrorBoundary>} />
        <Route path="/client/login" element={<ErrorBoundary><ClientLogin /></ErrorBoundary>} />
        <Route path="/client/dashboard" element={<ErrorBoundary><ClientDashboard /></ErrorBoundary>} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/dashboard/audit" element={<ErrorBoundary><AuditHome /></ErrorBoundary>} />
        <Route path="/dashboard/audit/result/:id" element={<ErrorBoundary><AuditResult /></ErrorBoundary>} />
        <Route path="/dashboard/audit/reports" element={<ErrorBoundary><AuditReports /></ErrorBoundary>} />

        <Route path="/dashboard/voice" element={<ErrorBoundary><VoiceHome /></ErrorBoundary>} />

        <Route path="/dashboard/sms" element={<ErrorBoundary><SMSHome /></ErrorBoundary>} />

        <Route path="/dashboard/whatsapp" element={<ErrorBoundary><WhatsAppHome /></ErrorBoundary>} />

        <Route path="/dashboard/email" element={<EmailHome />} />
        <Route path="/dashboard/email/inbox" element={<EmailInbox />} />
        <Route path="/dashboard/email/campaigns" element={<EmailCampaigns />} />

        <Route path="/dashboard/social" element={<ErrorBoundary><SocialHome /></ErrorBoundary>} />

        <Route path="/dashboard/revive" element={<ErrorBoundary><ReviveHome /></ErrorBoundary>} />

        <Route path="/dashboard/inbox" element={<ErrorBoundary><UnifiedInbox /></ErrorBoundary>} />

        <Route path="/dashboard/agents" element={<AgentList />} />
        <Route path="/dashboard/agents/create" element={<AgentCreate />} />
        <Route path="/dashboard/agents/knowledge-bases" element={<ErrorBoundary><KnowledgeHome /></ErrorBoundary>} />
        <Route path="/dashboard/agents/voices" element={<Voices />} />
        <Route path="/dashboard/agents/:id" element={<AgentDetail />} />

        <Route path="/dashboard/crm" element={<ErrorBoundary><CRMPipeline /></ErrorBoundary>} />
        <Route path="/dashboard/crm/contacts" element={<ErrorBoundary><CRMContacts /></ErrorBoundary>} />
        <Route path="/dashboard/crm/contact/:id" element={<ErrorBoundary><CRMContactDetail /></ErrorBoundary>} />

        <Route path="/dashboard/knowledge" element={<ErrorBoundary><KnowledgeHome /></ErrorBoundary>} />

        <Route path="/dashboard/insights" element={<ErrorBoundary><InsightsHome /></ErrorBoundary>} />

        <Route path="/dashboard/book" element={<ErrorBoundary><BookHome /></ErrorBoundary>} />

        <Route path="/dashboard/flow" element={<ErrorBoundary><FlowHome /></ErrorBoundary>} />

        <Route path="/dashboard/sales" element={<ErrorBoundary><SalesHome /></ErrorBoundary>} />

        <Route path="/dashboard/tron" element={<ErrorBoundary><TronHome /></ErrorBoundary>} />

        <Route path="/dashboard/finances" element={<ErrorBoundary><FinancesHome /></ErrorBoundary>} />

        <Route path="/dashboard/reviews" element={<ErrorBoundary><ReviewsHome /></ErrorBoundary>} />

        <Route path="/dashboard/media" element={<ErrorBoundary><MediaHome /></ErrorBoundary>} />

        <Route path="/dashboard/tax" element={<ErrorBoundary><TaxHome /></ErrorBoundary>} />

        <Route path="/dashboard/law" element={<ErrorBoundary><LawHome /></ErrorBoundary>} />

        <Route path="/dashboard/hire" element={<ErrorBoundary><HireHome /></ErrorBoundary>} />

        <Route path="/dashboard/client-portal" element={<ErrorBoundary><ClientPortalAdmin /></ErrorBoundary>} />

        <Route path="/dashboard/docs" element={<ErrorBoundary><DocsHome /></ErrorBoundary>} />

        <Route path="/dashboard/shield" element={<ErrorBoundary><ShieldHome /></ErrorBoundary>} />

        <Route path="/dashboard/settings" element={<Settings />} />
        <Route path="/dashboard/logs" element={<Logs />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App
