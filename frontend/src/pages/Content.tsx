import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCampaigns, generateContent } from '../api'

interface ContentResult {
  content_id: number
  campaign_id: number
  title: string
  raw_content: string
  platform_versions: Record<string, string>
}

function Content() {
  const [campaignId, setCampaignId] = useState<number | ''>('')
  const [topic, setTopic] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['linkedin', 'twitter'])
  const [result, setResult] = useState<ContentResult | null>(null)
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Content Generation</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Generate platform-optimized content based on your research
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Input Form */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Generate Content</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label" htmlFor="campaign">Campaign</label>
              <select
                id="campaign"
                className="input"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">Select a campaign...</option>
                {campaigns?.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} ({campaign.niche})
                  </option>
                ))}
              </select>
              {(!campaigns || campaigns.length === 0) && (
                <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.25rem' }}>
                  Run market research first to create a campaign
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="label" htmlFor="topic">Content Topic</label>
              <textarea
                id="topic"
                className="textarea"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., 5 benefits of registering a company in Cyprus for international businesses"
                required
              />
            </div>

            <div className="form-group">
              <label className="label">Target Platforms</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['linkedin', 'twitter', 'instagram', 'youtube'].map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => handlePlatformToggle(platform)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: platforms.includes(platform) ? 'var(--primary)' : 'white',
                      color: platforms.includes(platform) ? 'white' : 'var(--text)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending || !campaignId}
              style={{ width: '100%' }}
            >
              {mutation.isPending ? 'Generating...' : 'Generate Content'}
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
                Select a campaign, enter a topic, and generate content.
              </p>
            </div>
          )}

          {mutation.isPending && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--primary)' }}>Generating content...</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Creating optimized versions for each platform
              </p>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title */}
              <div className="card">
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>{result.title}</h4>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>{result.raw_content}</p>
              </div>

              {/* Platform Versions */}
              {Object.entries(result.platform_versions).map(([platform, content]) => (
                <div key={platform} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ textTransform: 'capitalize', color: 'var(--primary)' }}>{platform}</h4>
                    <button
                      onClick={() => copyToClipboard(content)}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{
                    background: '#f8fafc',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {content}
                  </div>
                  {platform === 'twitter' && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      {content.length}/280 characters
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Content
