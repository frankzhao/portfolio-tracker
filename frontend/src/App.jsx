import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import RecordMonth from './pages/RecordMonth'
import History from './pages/History'
import Transactions from './pages/Transactions'
import AssetsPage from './pages/AssetsPage'
import Portfolio from './pages/Portfolio'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="content-wrapper">
          <header className="mobile-topbar">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Toggle navigation"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span className="mobile-logo">📈 Portfolio</span>
          </header>
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/record" element={<RecordMonth />} />
              <Route path="/history" element={<History />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/assets" element={<AssetsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
