import { Component } from 'react'
import { RotateCcw } from 'lucide-react'

const GOLD = '#C8A96E'

// Catches render-time exceptions anywhere below it in the tree so a bug in one page (a bad
// field access, a malformed API response, etc.) shows a friendly message instead of a blank
// white screen. Fetch/async errors are handled separately in each page — this is the backstop
// for everything else.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#080808' }}>
          <div className="max-w-md text-center">
            <p className="text-lg font-bold text-white mb-3">Something went wrong running the audit.</p>
            <p className="text-sm mb-6" style={{ color: '#999999' }}>
              Please try again. If the problem continues contact{' '}
              <a href="mailto:hello@nova-systems.app" style={{ color: GOLD }}>hello@nova-systems.app</a>.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = '/dashboard/audit' }}
              className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] rounded-lg"
              style={{ background: GOLD, color: '#080808' }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
