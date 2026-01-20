import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Search,
  FileText,
  Send,
  TrendingUp,
  Zap,
  Target,
  ArrowRight,
  Plus,
} from 'lucide-react'
import { getCampaigns } from '../api'

const stats = [
  { label: 'Campaigns', value: '12', change: '+2 this week', icon: Target, color: 'from-primary-500 to-primary-700' },
  { label: 'Content Pieces', value: '48', change: '+15 this week', icon: FileText, color: 'from-emerald-500 to-emerald-700' },
  { label: 'Posts Scheduled', value: '24', change: '8 pending', icon: Send, color: 'from-amber-500 to-amber-700' },
  { label: 'Engagement', value: '2.4k', change: '+18%', icon: TrendingUp, color: 'from-purple-500 to-purple-700' },
]

const quickActions = [
  {
    to: '/research',
    icon: Search,
    title: 'New Research',
    description: 'Analyze a market niche with AI',
    color: 'group-hover:text-primary-400',
  },
  {
    to: '/content',
    icon: FileText,
    title: 'Create Content',
    description: 'Generate multi-platform content',
    color: 'group-hover:text-emerald-400',
  },
  {
    to: '/distribute',
    icon: Send,
    title: 'Schedule Posts',
    description: 'Distribute to social media',
    color: 'group-hover:text-amber-400',
  },
]

export default function Dashboard() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-dark-400 mt-1">Welcome back! Here's what's happening with your campaigns.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card group hover:border-dark-700 transition-all duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-dark-400 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                <p className="text-xs text-dark-500 mt-1">{stat.change}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="card group hover:border-dark-700 hover:bg-dark-800/50 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center group-hover:bg-dark-700 transition-colors">
                  <action.icon className={`w-6 h-6 text-dark-400 transition-colors ${action.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors flex items-center gap-2">
                    {action.title}
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </h3>
                  <p className="text-sm text-dark-400 mt-1">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Campaigns */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Campaigns</h2>
          <Link to="/research" className="btn btn-ghost text-sm">
            <Plus className="w-4 h-4" />
            New Campaign
          </Link>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Campaign</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Niche</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-dark-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-white">{campaign.name}</span>
                      </td>
                      <td className="py-3 px-4 text-dark-400">{campaign.niche}</td>
                      <td className="py-3 px-4">
                        <span className={`badge ${campaign.status === 'active' ? 'badge-success' : 'badge-info'}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link to={`/content?campaign=${campaign.id}`} className="btn btn-ghost text-xs">
                          <Zap className="w-3 h-3" />
                          Generate
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-dark-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
              <p className="text-dark-400 mb-4">Start by running market research to create your first campaign.</p>
              <Link to="/research" className="btn btn-primary">
                <Search className="w-4 h-4" />
                Start Research
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
