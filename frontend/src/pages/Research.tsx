import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Sparkles,
  Users,
  Target,
  Lightbulb,
  Globe,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { analyzeMarket } from '../api'

interface ResearchResult {
  research_id: number
  campaign_id: number
  market_analysis: string
  target_audience: Array<{
    persona_name: string
    description: string
    pain_points: string[]
    goals: string[]
  }>
  competitors: Array<{
    type: string
    positioning: string
    content_strategy: string
  }>
  content_angles: string[]
  platform_recommendations: Array<{
    platform: string
    reason: string
    content_format: string
  }>
}

export default function Research() {
  const [niche, setNiche] = useState('offshore company registration')
  const [context, setContext] = useState('')
  const [result, setResult] = useState<ResearchResult | null>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: analyzeMarket,
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      niche,
      additional_context: context || undefined,
    })
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Market Research</h1>
        <p className="text-dark-400 mt-1">Analyze your target market with AI to inform content strategy</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Research Parameters</h2>
              <p className="text-sm text-dark-400">Define your target market</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="niche">Market Niche</label>
              <input
                id="niche"
                className="input"
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g., offshore company registration"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="context">Additional Context (optional)</label>
              <textarea
                id="context"
                className="textarea h-32"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., Focus on European entrepreneurs, Cyprus jurisdiction..."
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run Analysis
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
                <Target className="w-10 h-10 text-dark-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Ready to Research</h3>
              <p className="text-dark-400 max-w-sm">
                Enter a niche and click "Run Analysis" to get AI-powered market insights.
              </p>
            </div>
          )}

          {mutation.isPending && (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-primary-500/10 flex items-center justify-center mb-4">
                <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Analyzing Market</h3>
              <p className="text-dark-400">This may take 15-30 seconds...</p>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Success indicator */}
              <div className="card bg-emerald-500/10 border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Research Complete</span>
                </div>
              </div>

              {/* Market Analysis */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="w-5 h-5 text-primary-400" />
                  <h3 className="font-semibold text-white">Market Analysis</h3>
                </div>
                <p className="text-dark-300 whitespace-pre-wrap leading-relaxed">{result.market_analysis}</p>
              </div>

              {/* Target Audience */}
              {result.target_audience.length > 0 && (
                <div className="card">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-semibold text-white">Target Audience</h3>
                  </div>
                  <div className="space-y-4">
                    {result.target_audience.map((persona, i) => (
                      <div key={i} className="p-4 bg-dark-800/50 rounded-lg">
                        <h4 className="font-medium text-white mb-2">{persona.persona_name}</h4>
                        <p className="text-sm text-dark-400 mb-3">{persona.description}</p>
                        {persona.pain_points.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {persona.pain_points.map((point, j) => (
                              <span key={j} className="badge badge-warning text-xs">{point}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Angles */}
              {result.content_angles.length > 0 && (
                <div className="card">
                  <div className="flex items-center gap-3 mb-4">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-white">Content Angles</h3>
                  </div>
                  <ul className="space-y-2">
                    {result.content_angles.map((angle, i) => (
                      <li key={i} className="flex items-start gap-3 text-dark-300">
                        <span className="w-6 h-6 rounded-full bg-dark-800 flex items-center justify-center text-xs text-dark-400 flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {angle}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Platform Recommendations */}
              {result.platform_recommendations.length > 0 && (
                <div className="card">
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="w-5 h-5 text-purple-400" />
                    <h3 className="font-semibold text-white">Platform Recommendations</h3>
                  </div>
                  <div className="space-y-3">
                    {result.platform_recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="badge badge-info">{rec.platform}</span>
                        <p className="text-sm text-dark-400">{rec.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
