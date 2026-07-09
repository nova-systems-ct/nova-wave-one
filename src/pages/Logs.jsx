import { List } from 'lucide-react'
import EnginePanel from '../components/EnginePanel'

export default function Logs() {
  return (
    <EnginePanel
      title="System Logs"
      description="Raw activity across every engine — useful for debugging delivery failures."
      emptyIcon={List}
      emptyText="No log entries yet."
    />
  )
}
