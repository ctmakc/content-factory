import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Research from './pages/Research'
import Content from './pages/Content'

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <nav style={{
        background: '#1e293b',
        padding: '1rem 0',
        borderBottom: '1px solid #334155'
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h1 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 600 }}>
            Content Factory
          </h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <NavLink
              to="/"
              style={({ isActive }) => ({
                color: isActive ? 'white' : '#94a3b8',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                background: isActive ? '#334155' : 'transparent',
                textDecoration: 'none'
              })}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/research"
              style={({ isActive }) => ({
                color: isActive ? 'white' : '#94a3b8',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                background: isActive ? '#334155' : 'transparent',
                textDecoration: 'none'
              })}
            >
              Research
            </NavLink>
            <NavLink
              to="/content"
              style={({ isActive }) => ({
                color: isActive ? 'white' : '#94a3b8',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                background: isActive ? '#334155' : 'transparent',
                textDecoration: 'none'
              })}
            >
              Content
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/research" element={<Research />} />
            <Route path="/content" element={<Content />} />
          </Routes>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: '#f1f5f9',
        padding: '1rem 0',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.875rem'
      }}>
        Content Factory - Marketing Automation Pipeline
      </footer>
    </div>
  )
}

export default App
