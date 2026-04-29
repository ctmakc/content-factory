import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Research from './pages/Research'
import Content from './pages/Content'
import Distribute from './pages/Distribute'
import Settings from './pages/Settings'
import Ops from './pages/Ops'
import Battles from './pages/Battles'
import Workspace from './pages/Workspace'
import Experiments from './pages/Experiments'
import PromptLab from './pages/PromptLab'

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
            <Route path="/ops" element={<Ops />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/battles" element={<Battles />} />
            <Route path="/promptlab" element={<PromptLab />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
