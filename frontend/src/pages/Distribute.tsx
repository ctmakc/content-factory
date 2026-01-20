import { useState } from 'react'
import {
  Send,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
} from 'lucide-react'

const platformIcons: Record<string, React.ElementType> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
}

const scheduledPosts = [
  { id: 1, platform: 'linkedin', title: 'Cyprus Company Benefits', status: 'scheduled', scheduledAt: '2024-01-22 10:00' },
  { id: 2, platform: 'twitter', title: 'Tax Optimization Tips', status: 'posted', postedAt: '2024-01-20 14:30' },
  { id: 3, platform: 'instagram', title: 'Offshore Registration Guide', status: 'failed', error: 'Authentication expired' },
]

export default function Distribute() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'posted' | 'failed'>('scheduled')

  const filteredPosts = scheduledPosts.filter(post => post.status === activeTab)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Distribution</h1>
        <p className="text-dark-400 mt-1">Schedule and manage your social media posts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">8</p>
              <p className="text-sm text-dark-400">Scheduled</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">24</p>
              <p className="text-sm text-dark-400">Posted</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">2</p>
              <p className="text-sm text-dark-400">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-800 pb-4">
        {(['scheduled', 'posted', 'failed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-primary-600/20 text-primary-400'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="card text-center py-12">
            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-dark-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No {activeTab} posts</h3>
            <p className="text-dark-400">Generate content and schedule it for distribution.</p>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const Icon = platformIcons[post.platform] || Send
            return (
              <div key={post.id} className="card hover:border-dark-700 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-dark-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{post.title}</h3>
                      <p className="text-sm text-dark-400 capitalize">{post.platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {post.status === 'scheduled' && (
                      <div className="flex items-center gap-2 text-amber-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">{post.scheduledAt}</span>
                      </div>
                    )}
                    {post.status === 'posted' && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">{post.postedAt}</span>
                      </div>
                    )}
                    {post.status === 'failed' && (
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{post.error}</span>
                      </div>
                    )}
                    <span className={`badge ${
                      post.status === 'scheduled' ? 'badge-warning' :
                      post.status === 'posted' ? 'badge-success' : 'badge-error'
                    }`}>
                      {post.status}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Coming Soon Notice */}
      <div className="card bg-primary-500/5 border-primary-500/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h3 className="font-medium text-white mb-1">Automated Posting Coming Soon</h3>
            <p className="text-sm text-dark-400">
              Connect your social media accounts in Settings to enable automatic posting.
              For now, you can copy content from the Content page and post manually.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
