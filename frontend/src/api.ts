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

export interface SecurityStatus {
  crypto: {
    configured: boolean
    using_default_secret: boolean
    storage_mode: string
    secret_source: string
  }
  api_keys: {
    total: number
    providers: Record<string, { count: number; defaults: number }>
  }
  accounts: {
    total: number
    platforms: Record<string, { count: number; connected: number }>
  }
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
  access_token?: string
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

export async function getSecurityStatus(): Promise<SecurityStatus> {
  return fetchAPI('/settings/security-status')
}

// ============ Ops / QWEN ============

export interface OpsRuntime {
  model?: string
  queue_path?: string
  output_root?: string
  limit?: number
  offset?: number
}

export interface OpsStatus {
  runner_state?: string
  active_model?: string
  total_items?: number
  completed_items?: number
  current_index?: number | null
  current_item?: Record<string, unknown> | null
  last_output?: string | null
  last_item_seconds?: number | null
  total_seconds?: number | null
  started_at?: string | null
  finished_at?: string | null
  output_root?: string
  runtime: OpsRuntime
}

export interface OpsOutputItem {
  path: string
  project: string
  name: string
  updated_at: number
  size: number
}

export interface OpsLogResponse {
  name: string
  path: string
  text: string
}

export interface PromptBattleItem {
  slug: string
  path: string
  topic: string
  language: string
  model: string
  candidate_count: number
  result_count: number
}

export interface PromptRegistryItem {
  key: string
  name: string
  path: string
  kind: string
  group: string
  label: string
  battle_slug?: string | null
  candidate_name?: string | null
  topic?: string | null
  language?: string | null
  model?: string | null
  prompt_role?: string | null
  updated_at: number
  size: number
}

export interface BattleTestCase {
  slug: string
  topic: string
  language: string
  model: string
  candidate_count: number
  result_count: number
  updated_at: string
  top_outputs: Array<{
    name: string
    chars: number
    words: number
    seconds: number
  }>
}

export interface PromptAssetProfile {
  id?: number
  asset_key: string
  project?: string | null
  label?: string | null
  status: string
  tier?: string | null
  tags_csv?: string | null
  notes?: string | null
  default_for_project?: boolean
  linked_test_case_slug?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface PromptTestCaseProfile {
  id?: number
  slug: string
  project?: string | null
  title?: string | null
  status: string
  notes?: string | null
  priority?: string | null
  tags_csv?: string | null
  target_model?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface PromptLabAsset extends PromptRegistryItem {
  profile?: PromptAssetProfile | null
  evaluation?: {
    verdict?: string | null
    overall_score?: number | null
    is_winner?: boolean
  } | null
}

export interface PromptLabTestCase extends BattleTestCase {
  profile?: PromptTestCaseProfile | null
}

export interface PromptLabDefault {
  asset: PromptRegistryItem
  profile: PromptAssetProfile
}

export interface PromptLabLeaderboardItem {
  asset_key: string
  asset?: PromptRegistryItem | null
  profile?: PromptAssetProfile | null
  project?: string | null
  candidate_name: string
  battle_count: number
  winner_count: number
  average_score?: number | null
  verdicts: Record<string, number>
  battle_slugs: string[]
}

export interface PromptLabLaunchBattleResponse {
  slug: string
  path: string
  manifest: {
    model: string
    topic: string
    language: string
    battle_type: string
    candidates: Array<{
      name: string
      user_prompt: string
      system_prompt?: string | null
    }>
  }
  run_state?: {
    pid?: number
    started_at?: string
    running?: boolean
    log_path?: string
  }
}

export interface OpsCatalogFile {
  name: string
  path: string
  relative_path: string
  updated_at: number
  size: number
}

export interface OpsCatalogModel {
  name: string
  id: string
  size: string
  modified: string
}

export interface OpsCatalog {
  queues: OpsCatalogFile[]
  prompts: OpsCatalogFile[]
  models: OpsCatalogModel[]
  output_roots: Array<{
    name: string
    path: string
    updated_at: number
    article_count: number
  }>
}

export interface PromptBattleCandidate {
  name: string
  user_prompt: string
  system_prompt?: string | null
  evaluation?: PromptBattleEvaluation | null
  result?: {
    name: string
    seconds: number
    article_path: string
    chars: number
    words: number
    h2: number
    h3: number
    lists: number
    paragraphs: number
  }
}

export interface PromptBattleEvaluation {
  id?: number
  battle_slug: string
  candidate_name: string
  candidate_key?: string
  article_path?: string | null
  usefulness_score?: number | null
  seo_score?: number | null
  geo_score?: number | null
  human_score?: number | null
  brand_fit_score?: number | null
  safety_score?: number | null
  verdict?: string | null
  notes?: string | null
  is_winner?: boolean
  overall_score?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface PromptBattleDetail {
  slug: string
  manifest: {
    topic: string
    model: string
    language: string
  }
  summary?: {
    generated_at?: string
  }
  run_state?: {
    pid?: number
    started_at?: string
    running?: boolean
    log_path?: string
  }
  evaluation_summary?: {
    count: number
    winners: number
    verdicts: Record<string, number>
    ranking: Array<{
      candidate_name: string
      overall_score: number | null
      verdict?: string | null
      is_winner: boolean
    }>
  }
  log?: string
  candidates: PromptBattleCandidate[]
}

export interface WorkspaceRun {
  slug: string
  name: string
  source_type: string
  root: string
  article_count: number
  project_count: number
  projects: string[]
  updated_at: number
}

export interface WorkspaceReview {
  id?: number
  run_slug: string
  artifact_path: string
  project?: string | null
  title?: string | null
  usefulness_score?: number | null
  seo_score?: number | null
  geo_score?: number | null
  human_score?: number | null
  brand_fit_score?: number | null
  safety_score?: number | null
  verdict?: string | null
  notes?: string | null
  tags?: string[]
  created_at?: string | null
  updated_at?: string | null
}

export interface WorkspaceArticle {
  artifact_path: string
  project: string
  name: string
  title: string
  chars: number
  words: number
  updated_at: number
  run_slug: string
  review?: WorkspaceReview
  auto_quality?: {
    flags: string[]
    flag_count: number
    tier: string
    suggested_verdict: string
  }
}

export interface WorkspaceCompareCandidate {
  artifact_path: string
  project: string
  run_slug: string
  run_name: string
  name: string
  title: string
  chars: number
  words: number
  updated_at: number
}

export interface WorkspaceCompareResponse {
  target: {
    artifact_path: string
    project: string
    name: string
  }
  items: WorkspaceCompareCandidate[]
}

export interface WorkspaceDiffBlock {
  tag: string
  left: string[]
  right: string[]
}

export interface WorkspaceDiffResponse {
  left_path: string
  right_path: string
  summary: {
    left_paragraphs: number
    right_paragraphs: number
    equal_paragraphs: number
    changed_left_paragraphs: number
    changed_right_paragraphs: number
    similarity_ratio: number
  }
  blocks: WorkspaceDiffBlock[]
}

export interface PublicationExperiment {
  id?: number
  project: string
  content_title: string
  source_artifact_path?: string | null
  platform: string
  status: string
  published_url?: string | null
  canonical_url?: string | null
  search_property?: string | null
  index_status?: string | null
  rank_status?: string | null
  target_query?: string | null
  country?: string | null
  device?: string | null
  baseline_rank?: string | null
  latest_rank?: string | null
  payload_format?: string | null
  payload_json?: string | null
  tags_csv?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ExperimentPlatformPlaybook {
  platform: string
  label: string
  publish_mode: string
  readiness: string
  needs: string[]
  notes: string
  can_publish: boolean
  steps: string[]
  docs_url?: string
}

export interface ExperimentPayloadPreview {
  platform: string
  format: string
  payload: Record<string, unknown>
  payload_pretty: string
  resolved_candidate?: ExperimentResolvedCandidate
}

export interface ExperimentResolvedCandidate {
  source_artifact_path: string
  selected_artifact_path: string
  selected_title: string
  selected_kind: string
  selected_review_verdict?: string | null
  selected_review_score?: number | null
  candidates: Array<{
    artifact_path: string
    title: string
    kind: string
    run_slug?: string | null
    run_name?: string | null
    updated_at: number
    chars: number
    words: number
    review_verdict?: string | null
    review_score?: number | null
  }>
}

export interface ExperimentBundle {
  experiment: PublicationExperiment
  title: string
  body_markdown: string
  payload: ExperimentPayloadPreview
  checklist: string[]
  resolved_candidate?: ExperimentResolvedCandidate
  suggested_files: {
    article_markdown: string
    payload_json: string
    notes_markdown: string
  }
}

export interface BatchPrepareResponse {
  run_slug: string
  platform: string
  created: PublicationExperiment[]
  skipped: Array<{
    artifact_path: string
    reason: string
    id?: number
  }>
}

export interface ExperimentExportResponse {
  root: string | null
  count: number
  files: string[]
}

export interface WorkspaceScorecard {
  run_slug: string
  review_count: number
  averages: Record<string, number | null>
  verdicts: Record<string, number>
}

export interface WorkspaceReviewSummary {
  run_slug: string
  review_count: number
  projects: Record<string, { count: number; verdicts: Record<string, number> }>
}

export interface WorkspaceQualityGates {
  run_slug: string
  article_count: number
  tiers: Record<string, number>
  suggested_verdicts: Record<string, number>
  top_flags: Record<string, number>
}

export interface WorkspaceRewriteQueueBuild {
  run_slug: string
  queue_path: string
  count: number
  items: Array<Record<string, unknown>>
}

export interface WorkspaceRewriteLaunchResponse extends WorkspaceRewriteQueueBuild {
  output_root: string
  launch: {
    action: string
    status: string
  }
}

export interface WorkspaceLineageItem {
  artifact_path: string
  meta_path: string
  run_slug: string
  run_name: string
  project: string
  title: string
  rewrite_focus: string[]
  updated_at: number
  chars: number
  words: number
  depth?: number
}

export interface WorkspaceLineageResponse {
  target: string
  children: WorkspaceLineageItem[]
  edges: Array<{
    parent_artifact_path: string
    artifact_path: string
    depth: number
  }>
  latest_descendant?: WorkspaceLineageItem | null
  descendant_count: number
  max_depth: number
}

export interface WorkspaceRewriteHistory {
  run_slug: string
  source_article_count: number
  rewritten_article_count: number
  descendant_count: number
  latest_descendant?: WorkspaceLineageItem | null
  latest_runs: Record<string, number>
  effectiveness: {
    improved_descendants: number
    regressed_descendants: number
    unchanged_descendants: number
    avg_char_delta: number
    avg_word_delta: number
  }
  top_rewritten: Array<{
    source_artifact_path: string
    title: string
    descendant_count: number
    latest_descendant?: WorkspaceLineageItem | null
  }>
}

export async function getOpsStatus(): Promise<OpsStatus> {
  return fetchAPI('/ops/status')
}

export async function getOpsRuntime(): Promise<OpsRuntime> {
  return fetchAPI('/ops/runtime')
}

export async function getOpsCatalog(): Promise<OpsCatalog> {
  return fetchAPI('/ops/catalog')
}

export async function updateOpsRuntime(data: OpsRuntime): Promise<OpsRuntime> {
  return fetchAPI('/ops/runtime', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function runOpsAction(action: string): Promise<{ action: string; status: string }> {
  return fetchAPI('/ops/action', {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}

export async function launchOpsRun(data: OpsRuntime & { stop_existing?: boolean }): Promise<{ action: string; status: string }> {
  return fetchAPI('/ops/launch', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getOpsPrompt(name = 'seo_article_system.txt'): Promise<{ name: string; path: string; text: string }> {
  return fetchAPI(`/ops/prompt?name=${encodeURIComponent(name)}`)
}

export async function saveOpsPrompt(data: { name?: string; text: string }): Promise<{ name: string; path: string }> {
  return fetchAPI('/ops/prompt', {
    method: 'POST',
    body: JSON.stringify({ name: data.name ?? 'seo_article_system.txt', text: data.text }),
  })
}

export async function getOpsQueue(limit = 100): Promise<{ items: Array<Record<string, unknown>> }> {
  return fetchAPI(`/ops/queue?limit=${limit}`)
}

export async function getOpsOutputs(limit = 100, root?: string): Promise<{ items: OpsOutputItem[] }> {
  const query = new URLSearchParams({ limit: String(limit) })
  if (root) query.set('root', root)
  return fetchAPI(`/ops/outputs?${query.toString()}`)
}

export async function getOpsLogs(name: string, maxChars = 20000): Promise<OpsLogResponse> {
  return fetchAPI(`/ops/logs?name=${encodeURIComponent(name)}&max_chars=${maxChars}`)
}

export async function getOpsFile(path: string): Promise<{ path: string; text: string }> {
  return fetchAPI(`/ops/file?path=${encodeURIComponent(path)}`)
}

export async function getPromptBattles(): Promise<{ items: PromptBattleItem[] }> {
  return fetchAPI('/ops/battles')
}

export async function getPromptRegistry(): Promise<{ items: PromptRegistryItem[] }> {
  return fetchAPI('/ops/prompt-registry')
}

export async function getBattleTestCases(): Promise<{ items: BattleTestCase[] }> {
  return fetchAPI('/ops/test-cases')
}

export async function getPromptLabAssets(): Promise<{ items: PromptLabAsset[] }> {
  return fetchAPI('/promptlab/assets')
}

export async function savePromptLabAsset(data: PromptAssetProfile): Promise<PromptAssetProfile> {
  return fetchAPI('/promptlab/assets', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getPromptLabDefaults(): Promise<{ items: PromptLabDefault[] }> {
  return fetchAPI('/promptlab/defaults')
}

export async function activatePromptLabAsset(data: {
  asset_key: string
  target_prompt_name?: string
}): Promise<{ status: string; asset_key: string; asset_path: string; target_prompt_name: string }> {
  return fetchAPI('/promptlab/activate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function launchPromptLabBattle(data: {
  test_case_slug: string
  asset_keys: string[]
  model?: string
  slug_hint?: string
  auto_start?: boolean
}): Promise<PromptLabLaunchBattleResponse> {
  return fetchAPI('/promptlab/launch-battle', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getPromptLabLeaderboard(project?: string): Promise<{ items: PromptLabLeaderboardItem[] }> {
  const search = project ? `?project=${encodeURIComponent(project)}` : ''
  return fetchAPI(`/promptlab/leaderboard${search}`)
}

export async function getPromptLabTestCases(): Promise<{ items: PromptLabTestCase[] }> {
  return fetchAPI('/promptlab/test-cases')
}

export async function savePromptLabTestCase(data: PromptTestCaseProfile): Promise<PromptTestCaseProfile> {
  return fetchAPI('/promptlab/test-cases', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getPromptBattle(slug: string): Promise<PromptBattleDetail> {
  return fetchAPI(`/ops/battles/${encodeURIComponent(slug)}`)
}

export async function startPromptBattle(slug: string): Promise<{ pid?: number; running?: boolean; started_at?: string }> {
  return fetchAPI(`/ops/battles/${encodeURIComponent(slug)}/start`, {
    method: 'POST',
  })
}

export async function savePromptBattleEvaluation(
  slug: string,
  data: PromptBattleEvaluation,
): Promise<PromptBattleEvaluation> {
  return fetchAPI(`/ops/battles/${encodeURIComponent(slug)}/evaluations`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ============ Workspace ============

export async function getWorkspaceRuns(): Promise<{ items: WorkspaceRun[] }> {
  return fetchAPI('/workspace/runs')
}

export async function getWorkspaceRunArticles(slug: string, limit = 200): Promise<{ items: WorkspaceArticle[] }> {
  return fetchAPI(`/workspace/runs/${encodeURIComponent(slug)}/articles?limit=${limit}`)
}

export async function getWorkspaceInbox(filters?: {
  verdict?: string
  project?: string
  runSlug?: string
  limit?: number
}): Promise<{ items: WorkspaceArticle[] }> {
  const query = new URLSearchParams()
  if (filters?.verdict) query.set('verdict', filters.verdict)
  if (filters?.project) query.set('project', filters.project)
  if (filters?.runSlug) query.set('run_slug', filters.runSlug)
  query.set('limit', String(filters?.limit ?? 200))
  return fetchAPI(`/workspace/inbox?${query.toString()}`)
}

export async function getWorkspaceReviews(filters?: { runSlug?: string; verdict?: string; project?: string }): Promise<{ items: WorkspaceReview[] }> {
  const query = new URLSearchParams()
  if (filters?.runSlug) query.set('run_slug', filters.runSlug)
  if (filters?.verdict) query.set('verdict', filters.verdict)
  if (filters?.project) query.set('project', filters.project)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return fetchAPI(`/workspace/reviews${suffix}`)
}

export async function getWorkspaceReviewSummary(slug: string): Promise<WorkspaceReviewSummary> {
  return fetchAPI(`/workspace/runs/${encodeURIComponent(slug)}/review-summary`)
}

export async function saveWorkspaceReview(data: WorkspaceReview): Promise<WorkspaceReview> {
  return fetchAPI('/workspace/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getWorkspaceScorecard(slug: string): Promise<WorkspaceScorecard> {
  return fetchAPI(`/workspace/runs/${encodeURIComponent(slug)}/scorecard`)
}

export async function getWorkspaceQualityGates(slug: string): Promise<WorkspaceQualityGates> {
  return fetchAPI(`/workspace/runs/${encodeURIComponent(slug)}/quality-gates`)
}

export async function buildWorkspaceRewriteQueue(data: {
  run_slug: string
  project?: string
  verdict?: string
  auto_tier?: string
  limit?: number
  queue_name?: string
}): Promise<WorkspaceRewriteQueueBuild> {
  return fetchAPI(`/workspace/runs/${encodeURIComponent(data.run_slug)}/build-rewrite-queue`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function launchWorkspaceRewriteRun(data: {
  run_slug: string
  project?: string
  verdict?: string
  auto_tier?: string
  limit?: number
  queue_name?: string
  model?: string
  output_root?: string
}): Promise<WorkspaceRewriteLaunchResponse> {
  return fetchAPI(`/workspace/runs/${encodeURIComponent(data.run_slug)}/launch-rewrite-run`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getWorkspaceLineage(artifactPath: string): Promise<WorkspaceLineageResponse> {
  return fetchAPI(`/workspace/lineage?artifact_path=${encodeURIComponent(artifactPath)}`)
}

export async function getWorkspaceRewriteHistory(slug: string): Promise<WorkspaceRewriteHistory> {
  return fetchAPI(`/workspace/runs/${encodeURIComponent(slug)}/rewrite-history`)
}

export async function getWorkspaceCompare(artifactPath: string, limit = 20): Promise<WorkspaceCompareResponse> {
  return fetchAPI(`/workspace/compare?artifact_path=${encodeURIComponent(artifactPath)}&limit=${limit}`)
}

export async function getWorkspaceDiff(leftPath: string, rightPath: string): Promise<WorkspaceDiffResponse> {
  return fetchAPI(`/workspace/diff?left_path=${encodeURIComponent(leftPath)}&right_path=${encodeURIComponent(rightPath)}`)
}

// ============ Experiments ============

export async function getPublicationExperiments(): Promise<{ items: PublicationExperiment[] }> {
  return fetchAPI('/experiments')
}

export async function savePublicationExperiment(data: PublicationExperiment): Promise<PublicationExperiment> {
  return fetchAPI('/experiments', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getExperimentPlatforms(): Promise<{ items: ExperimentPlatformPlaybook[] }> {
  return fetchAPI('/experiments/platforms')
}

export async function getExperimentPayloadPreview(data: {
  platform: string
  source_artifact_path?: string | null
  content_title?: string | null
  canonical_url?: string | null
  published_url?: string | null
  tags?: string[]
  prefer_latest_iteration?: boolean
}): Promise<ExperimentPayloadPreview> {
  return fetchAPI('/experiments/payload-preview', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getExperimentCandidate(sourceArtifactPath: string, preferLatestIteration = true): Promise<ExperimentResolvedCandidate> {
  return fetchAPI(
    `/experiments/candidate?source_artifact_path=${encodeURIComponent(sourceArtifactPath)}&prefer_latest_iteration=${String(preferLatestIteration)}`,
  )
}

export async function getExperimentBundle(experimentId: number): Promise<ExperimentBundle> {
  return fetchAPI(`/experiments/${experimentId}/bundle`)
}

export async function batchPrepareExperiments(data: {
  run_slug: string
  platform: string
  project?: string | null
  verdict?: string | null
  limit?: number
  tags?: string[]
  prefer_latest_iteration?: boolean
}): Promise<BatchPrepareResponse> {
  return fetchAPI('/experiments/batch-prepare', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function exportExperimentBundles(data: {
  experiment_ids: number[]
  label?: string
}): Promise<ExperimentExportResponse> {
  return fetchAPI('/experiments/export-bundles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
