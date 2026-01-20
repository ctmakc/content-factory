import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Search,
  FileText,
  Send,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/research', icon: Search, label: 'Research' },
  { to: '/content', icon: FileText, label: 'Content' },
  { to: '/distribute', icon: Send, label: 'Distribute' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-dark-900 border-r border-dark-800 flex flex-col transition-all duration-300 z-50 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className={`p-4 border-b border-dark-800 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-600/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="font-bold text-white">Content Factory</h1>
            <p className="text-xs text-dark-500">Marketing Automation</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                isActive
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-400' : ''}`} />
                {!collapsed && <span className="animate-fade-in">{item.label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-dark-800 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
              isActive
                ? 'bg-primary-600/20 text-primary-400'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
            } ${collapsed ? 'justify-center' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <Settings className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-400' : ''}`} />
              {!collapsed && <span className="animate-fade-in">Settings</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  Settings
                </div>
              )}
            </>
          )}
        </NavLink>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-dark-400 hover:text-dark-200 hover:bg-dark-800 w-full ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
