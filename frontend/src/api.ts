/**
 * API client for Content Factory backend
 */

const API_BASE = '/api'

interface Campaign {
  id: number
  name: string
  niche: string
  description: string | null
  status: string
}

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

interface ContentResult {
  content_id: number
  campaign_id: number
  title: string
  raw_content: string
  platform_versions: Record<string, string>
}

interface ContentItem {
  id: number
  campaign_id: number
  title: string
  content_type: string
  topic: string | null
  raw_content: string
  platform_versions: Record<string, string>
  created_at: string
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }

  return response.json()
}

// Campaigns
export async function getCampaigns(): Promise<Campaign[]> {
  return fetchAPI('/research/campaigns')
}

export async function createCampaign(data: { name: string; niche: string; description?: string }): Promise<Campaign> {
  return fetchAPI('/research/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Research
export async function analyzeMarket(data: {
  niche: string
  additional_context?: string
  campaign_id?: number
}): Promise<ResearchResult> {
  return fetchAPI('/research/analyze', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCampaignResearch(campaignId: number): Promise<ResearchResult[]> {
  return fetchAPI(`/research/campaigns/${campaignId}/research`)
}

// Content
export async function generateContent(data: {
  campaign_id: number
  topic: string
  content_type?: string
  platforms?: string[]
  use_research?: boolean
}): Promise<ContentResult> {
  return fetchAPI('/content/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCampaignContent(campaignId: number): Promise<ContentItem[]> {
  return fetchAPI(`/content/campaigns/${campaignId}/content`)
}

export async function getContent(contentId: number): Promise<ContentItem> {
  return fetchAPI(`/content/${contentId}`)
}

// Distribution
export async function postContent(data: {
  content_id: number
  platform: string
  account_id?: number
}): Promise<unknown> {
  return fetchAPI('/distribution/post', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ============ Settings ============

export interface ApiKey {
  id: number
  provider: string
  name: string
  api_key_masked: string
  is_default: boolean
  is_active: boolean
}

export interface SocialAccount {
  id: number
  platform: string
  username: string
  display_name: string | null
  is_connected: boolean
  is_active: boolean
}

// API Keys
export async function getApiKeys(): Promise<ApiKey[]> {
  return fetchAPI('/settings/api-keys')
}

export async function createApiKey(data: {
  provider: string
  name: string
  api_key: string
}): Promise<ApiKey> {
  return fetchAPI('/settings/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteApiKey(keyId: number): Promise<void> {
  return fetchAPI(`/settings/api-keys/${keyId}`, {
    method: 'DELETE',
  })
}

export async function setDefaultApiKey(keyId: number): Promise<void> {
  return fetchAPI(`/settings/api-keys/${keyId}/set-default`, {
    method: 'POST',
  })
}

// Social Accounts
export async function getSocialAccounts(): Promise<SocialAccount[]> {
  return fetchAPI('/settings/social-accounts')
}

export async function createSocialAccount(data: {
  platform: string
  username: string
  display_name?: string
}): Promise<SocialAccount> {
  return fetchAPI('/settings/social-accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteSocialAccount(accountId: number): Promise<void> {
  return fetchAPI(`/settings/social-accounts/${accountId}`, {
    method: 'DELETE',
  })
}
