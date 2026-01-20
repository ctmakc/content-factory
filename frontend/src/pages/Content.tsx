import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
} from 'lucide-react'
import { getCampaigns, generateContent } from '../api'

interface ContentResult {
  content_id: number
  campaign_id: number
  title: string
  raw_content: string
  platform_versions: Record<string, string>
}

const platformIcons: Record<string, React.ElementType> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
}

const platformColors: Record<string, string> = {
  linkedin: 'from-blue-600 to-blue-800',
  twitter: 'from-sky-500 to-sky-700',
  instagram: 'from-pink-500 to-purple-600',
  youtube: 'from-red-500 to-red-700',
}

export default function Content() {
  const [campaignId, setCampaignId] = useState<number | ''>('')
  const [topic, setTopic] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['linkedin', 'twitter'])
  const [result, setResult] = useState<ContentResult | null>(null)
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  })

  const mutation = useMutation({
    mutationFn: generateContent,
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })

  const handlePlatformToggle = (platform: string) => {
    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!campaignId) return
    mutation.mutate({
      campaign_id: campaignId,
      topic,
      platforms,
      use_research: true,
    })
  }

  const copyToClipboard = async (text: string, platform: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedPlatform(platform)
    setTimeout(() => setCopiedPlatform(null), 2000)
  }

  const availablePlatforms = ['linkedin', 'twitter', 'instagram', 'youtube']

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Content Generation</h1>
        <p className="text-dark-400 mt-1">Generate platform-optimized content based on your research</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Generate Content</h2>
              <p className="text-sm text-dark-400">Create AI-powered content</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="campaign">Campaign</label>
              <select
                id="campaign"
                className="select"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">Select a campaign...</option>
                {campaigns?.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              {(!campaigns || campaigns.length === 0) && (
                <p className="text-xs text-amber-400 mt-2">
                  Run market research first to create a campaign
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="topic">Content Topic</label>
              <textarea
                id="topic"
                className="textarea h-28"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., 5 benefits of registering a company in Cyprus for international businesses"
                required
              />
            </div>

            <div>
              <label className="label">Target Platforms</label>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => {
                  const Icon = platformIcons[platform]
                  const isSelected = platforms.includes(platform)
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => handlePlatformToggle(platform)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                          : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="capitalize text-sm">{platform}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={mutation.isPending || !campaignId}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Content
                </>
              )}
            </button>
          </form>

          {mutation.isError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{mutation.error.message}</p>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {!result && !mutation.isPending && (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-dark-800 flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-dark-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Ready to Create</h3>
              <p className="text-dark-400 max-w-sm">
                Select a campaign, enter a topic, and generate content for multiple platforms.
              </p>
            </div>
          )}

          {mutation.isPending && (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Generating Content</h3>
              <p className="text-dark-400">Creating optimized versions for each platform...</p>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Title & Raw Content */}
              <div className="card">
                <h3 className="text-xl font-semibold text-white mb-3">{result.title}</h3>
                <p className="text-dark-300 whitespace-pre-wrap leading-relaxed">{result.raw_content}</p>
              </div>

              {/* Platform Versions */}
              {Object.entries(result.platform_versions).map(([platform, content]) => {
                const Icon = platformIcons[platform] || FileText
                const gradient = platformColors[platform] || 'from-gray-500 to-gray-700'
                const isCopied = copiedPlatform === platform

                return (
                  <div key={platform} className="card">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="font-medium text-white capitalize">{platform}</h4>
                      </div>
                      <button
                        onClick={() => copyToClipboard(content, platform)}
                        className="btn btn-ghost text-xs"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-4 bg-dark-800/50 rounded-lg">
                      <p className="text-dark-300 whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
                    </div>
                    {platform === 'twitter' && (
                      <p className="text-xs text-dark-500 mt-2">
                        {content.length}/280 characters
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
