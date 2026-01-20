import { useQuery } from '@tanstack/react-query'
import { getCampaigns } from '../api'
import { Link } from 'react-router-dom'

function Dashboard() {
  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  })

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Dashboard</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Overview of your marketing campaigns and recent activity
        </p>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/research" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>New Research</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Analyze a market niche with AI
            </p>
          </div>
        </Link>
        <Link to="/content" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Create Content</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Generate content for multiple platforms
            </p>
          </div>
        </Link>
        <div className="card" style={{ opacity: 0.6 }}>
          <h3 style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>Schedule Posts</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Coming soon - schedule content distribution
          </p>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Recent Campaigns</h3>

        {isLoading && <p style={{ color: 'var(--text-muted)' }}>Loading campaigns...</p>}

        {error && (
          <p style={{ color: 'var(--error)' }}>
            Failed to load campaigns. Make sure the backend is running.
          </p>
        )}

        {campaigns && campaigns.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            No campaigns yet. <Link to="/research">Start with market research</Link> to create your first campaign.
          </p>
        )}

        {campaigns && campaigns.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 0', fontWeight: 500 }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0', fontWeight: 500 }}>Niche</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 0' }}>{campaign.name}</td>
                  <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{campaign.niche}</td>
                  <td style={{ padding: '0.75rem 0' }}>
                    <span className={`badge badge-${campaign.status === 'active' ? 'success' : 'info'}`}>
                      {campaign.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Dashboard
