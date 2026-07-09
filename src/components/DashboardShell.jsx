import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useAuthGuard } from '../hooks/useAuthGuard'

export default function DashboardShell({ title, children }) {
  useAuthGuard()
  return (
    <div className="min-h-screen" style={{ background: '#080808' }}>
      <Sidebar />
      <div style={{ marginLeft: 260 }}>
        <Navbar title={title} />
        <main className="px-8 py-8">{children}</main>
      </div>
    </div>
  )
}
