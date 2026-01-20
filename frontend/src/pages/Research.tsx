import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

function Research() {
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
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Market Research</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Analyze your target market with AI to inform content strategy
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Input Form */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Research Parameters</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
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
            <div className="form-group">
              <label className="label" htmlFor="context">Additional Context (optional)</label>
              <textarea
                id="context"
                className="textarea"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., Focus on European entrepreneurs, Cyprus jurisdiction..."
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending}
              style={{ width: '100%' }}
            >
              {mutation.isPending ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </form>

          {mutation.isError && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fee2e2', borderRadius: '6px', color: '#991b1b' }}>
              Error: {mutation.error.message}
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {!result && !mutation.isPending && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                Enter a niche and click "Run Analysis" to get AI-powered market research.
              </p>
            </div>
          )}

          {mutation.isPending && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--primary)' }}>Analyzing market...</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                This may take 15-30 seconds
              </p>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Market Analysis */}
              <div className="card">
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Market Analysis</h4>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>{result.market_analysis}</p>
              </div>

              {/* Target Audience */}
              {result.target_audience.length > 0 && (
                <div className="card">
                  <h4 style={{ marginBottom: '0.75rem', color: 'var(--primary)' }}>Target Audience</h4>
                  {result.target_audience.map((persona, i) => (
                    <div key={i} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: i < result.target_audience.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <strong>{persona.persona_name}</strong>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {persona.description}
                      </p>
                      {persona.pain_points.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Pain Points: </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {persona.pain_points.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Content Angles */}
              {result.content_angles.length > 0 && (
                <div className="card">
                  <h4 style={{ marginBottom: '0.75rem', color: 'var(--primary)' }}>Content Angles</h4>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                    {result.content_angles.map((angle, i) => (
                      <li key={i} style={{ marginBottom: '0.5rem' }}>{angle}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Platform Recommendations */}
              {result.platform_recommendations.length > 0 && (
                <div className="card">
                  <h4 style={{ marginBottom: '0.75rem', color: 'var(--primary)' }}>Platform Recommendations</h4>
                  {result.platform_recommendations.map((rec, i) => (
                    <div key={i} style={{ marginBottom: '0.75rem' }}>
                      <span className="badge badge-info" style={{ marginRight: '0.5rem' }}>{rec.platform}</span>
                      <span style={{ fontSize: '0.875rem' }}>{rec.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Research
