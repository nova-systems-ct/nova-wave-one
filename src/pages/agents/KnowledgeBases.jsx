import { BookOpen } from 'lucide-react'
import EnginePanel from '../../components/EnginePanel'

export default function KnowledgeBases() {
  return (
    <EnginePanel
      title="Knowledge Bases"
      description="What each agent knows about the business it represents — services, hours, FAQs, escalation rules."
      emptyIcon={BookOpen}
      emptyText="No knowledge bases yet — set one up from an agent's detail page."
    />
  )
}
