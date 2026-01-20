import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Research from './pages/Research'
import Content from './pages/Content'
import Distribute from './pages/Distribute'
import Settings from './pages/Settings'

function App() {
  return (
    <div className="min-h-screen bg-dark-950">
      <Sidebar />

      {/* Main content - with left margin for sidebar */}
      <main className="ml-64 min-h-screen transition-all duration-300">
        <div className="p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/research" element={<Research />} />
            <Route path="/content" element={<Content />} />
            <Route path="/distribute" element={<Distribute />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
