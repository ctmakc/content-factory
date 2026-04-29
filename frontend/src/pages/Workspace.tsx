import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Columns2, FileText, Filter, FolderTree, Save, Star } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  buildWorkspaceRewriteQueue,
  getOpsFile,
  getWorkspaceCompare,
  getWorkspaceDiff,
  getWorkspaceInbox,
  getWorkspaceLineage,
  getWorkspaceQualityGates,
  getWorkspaceRewriteHistory,
  getWorkspaceReviewSummary,
  getWorkspaceRunArticles,
  getWorkspaceRuns,
  getWorkspaceScorecard,
  launchWorkspaceRewriteRun,
  saveWorkspaceReview,
  type WorkspaceArticle,
  type WorkspaceReview,
} from '../api'

function formatDate(ts?: number) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

const scoreFields: Array<keyof WorkspaceReview> = [
  'usefulness_score',
  'seo_score',
  'geo_score',
  'human_score',
  'brand_fit_score',
  'safety_score',
]

const scoreLabels: Record<string, string> = {
  usefulness_score: 'Usefulness',
  seo_score: 'SEO',
  geo_score: 'GEO',
  human_score: 'Human',
  brand_fit_score: 'Brand Fit',
  safety_score: 'Safety',
}

export default function Workspace() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedRun, setSelectedRun] = useState('')
  const [selectedArticlePath, setSelectedArticlePath] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [verdictFilter, setVerdictFilter] = useState('')
  const [comparePath, setComparePath] = useState('')
  const [scopeMode, setScopeMode] = useState<'run' | 'inbox'>('run')
  const [draftReview, setDraftReview] = useState<WorkspaceReview>({
    run_slug: '',
    artifact_path: '',
    tags: [],
  })

  const { data: runs } = useQuery({
    queryKey: ['workspace-runs'],
    queryFn: getWorkspaceRuns,
  })

  useEffect(() => {
    if (!selectedRun && runs?.items?.length) {
      const runFromUrl = searchParams.get('run')
      const nextRun = runs.items.find((item) => item.slug === runFromUrl)?.slug ?? runs.items[0].slug
      setSelectedRun(nextRun)
    }
  }, [runs?.items, searchParams, selectedRun])

  useEffect(() => {
    const scopeFromUrl = searchParams.get('scope')
    if (scopeFromUrl === 'inbox' || scopeFromUrl === 'run') {
      setScopeMode(scopeFromUrl)
    }
  }, [searchParams])

  const { data: runArticles } = useQuery({
    queryKey: ['workspace-articles', selectedRun],
    queryFn: () => getWorkspaceRunArticles(selectedRun, 300),
    enabled: Boolean(selectedRun),
  })

  const { data: inboxArticles } = useQuery({
    queryKey: ['workspace-inbox', selectedRun, projectFilter, verdictFilter],
    queryFn: () => getWorkspaceInbox({
      runSlug: selectedRun || undefined,
      project: projectFilter || undefined,
      verdict: verdictFilter || undefined,
      limit: 300,
    }),
    enabled: scopeMode === 'inbox',
  })

  const { data: scorecard } = useQuery({
    queryKey: ['workspace-scorecard', selectedRun],
    queryFn: () => getWorkspaceScorecard(selectedRun),
    enabled: Boolean(selectedRun),
  })

  const { data: reviewSummary } = useQuery({
    queryKey: ['workspace-review-summary', selectedRun],
    queryFn: () => getWorkspaceReviewSummary(selectedRun),
    enabled: Boolean(selectedRun),
  })

  const { data: qualityGates } = useQuery({
    queryKey: ['workspace-quality-gates', selectedRun],
    queryFn: () => getWorkspaceQualityGates(selectedRun),
    enabled: Boolean(selectedRun),
  })

  const { data: rewriteHistory } = useQuery({
    queryKey: ['workspace-rewrite-history', selectedRun],
    queryFn: () => getWorkspaceRewriteHistory(selectedRun),
    enabled: Boolean(selectedRun),
  })

  const allRunArticles = runArticles?.items ?? []
  const articlesSource = scopeMode === 'inbox' ? (inboxArticles?.items ?? []) : allRunArticles

  useEffect(() => {
    const projectFromUrl = searchParams.get('project') ?? ''
    const verdictFromUrl = searchParams.get('verdict') ?? ''
    if (projectFromUrl !== projectFilter) setProjectFilter(projectFromUrl)
    if (verdictFromUrl !== verdictFilter) setVerdictFilter(verdictFromUrl)
  }, [projectFilter, searchParams, verdictFilter])

  const filteredArticles = useMemo(() => {
    if (scopeMode === 'inbox') return articlesSource
    return articlesSource.filter((item) => {
      if (projectFilter && item.project !== projectFilter) return false
      if (verdictFilter) {
        if (verdictFilter === '__unreviewed__') return !item.review?.verdict
        if (item.review?.verdict !== verdictFilter) return false
      }
      return true
    })
  }, [articlesSource, projectFilter, scopeMode, verdictFilter])

  useEffect(() => {
    if (!filteredArticles.length) {
      setSelectedArticlePath('')
      return
    }
    const articleFromUrl = searchParams.get('article')
    const nextArticle = filteredArticles.find((item) => item.artifact_path === articleFromUrl)?.artifact_path ?? filteredArticles[0].artifact_path
    if (!selectedArticlePath || !filteredArticles.some((item) => item.artifact_path === selectedArticlePath)) {
      setSelectedArticlePath(nextArticle)
    }
  }, [filteredArticles, searchParams, selectedArticlePath])

  const selectedArticle: WorkspaceArticle | undefined = useMemo(
    () => filteredArticles.find((item) => item.artifact_path === selectedArticlePath),
    [filteredArticles, selectedArticlePath],
  )

  const { data: articlePreview } = useQuery({
    queryKey: ['workspace-article-preview', selectedArticlePath],
    queryFn: () => getOpsFile(selectedArticlePath),
    enabled: Boolean(selectedArticlePath),
  })

  const { data: compareCandidates } = useQuery({
    queryKey: ['workspace-compare', selectedArticlePath],
    queryFn: () => getWorkspaceCompare(selectedArticlePath, 12),
    enabled: Boolean(selectedArticlePath),
  })

  useEffect(() => {
    const items = compareCandidates?.items ?? []
    if (!items.length) {
      setComparePath('')
      return
    }
    if (!comparePath || !items.some((item) => item.artifact_path === comparePath)) {
      setComparePath(items[0].artifact_path)
    }
  }, [compareCandidates?.items, comparePath])

  const { data: comparePreview } = useQuery({
    queryKey: ['workspace-compare-preview', comparePath],
    queryFn: () => getOpsFile(comparePath),
    enabled: Boolean(comparePath),
  })

  const { data: diffData } = useQuery({
    queryKey: ['workspace-diff', selectedArticlePath, comparePath],
    queryFn: () => getWorkspaceDiff(selectedArticlePath, comparePath),
    enabled: Boolean(selectedArticlePath && comparePath),
  })

  useEffect(() => {
    if (selectedArticle) {
      setDraftReview({
        run_slug: selectedArticle.run_slug,
        artifact_path: selectedArticle.artifact_path,
        project: selectedArticle.project,
        title: selectedArticle.title,
        usefulness_score: selectedArticle.review?.usefulness_score ?? null,
        seo_score: selectedArticle.review?.seo_score ?? null,
        geo_score: selectedArticle.review?.geo_score ?? null,
        human_score: selectedArticle.review?.human_score ?? null,
        brand_fit_score: selectedArticle.review?.brand_fit_score ?? null,
        safety_score: selectedArticle.review?.safety_score ?? null,
        verdict: selectedArticle.review?.verdict ?? 'draft',
        notes: selectedArticle.review?.notes ?? '',
        tags: selectedArticle.review?.tags ?? [],
      })
    }
  }, [selectedArticle])

  const reviewMutation = useMutation({
    mutationFn: saveWorkspaceReview,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-articles', selectedRun] })
      await queryClient.invalidateQueries({ queryKey: ['workspace-inbox'] })
      await queryClient.invalidateQueries({ queryKey: ['workspace-scorecard', selectedRun] })
      await queryClient.invalidateQueries({ queryKey: ['workspace-review-summary', selectedRun] })
    },
  })

  const rewriteQueueMutation = useMutation({
    mutationFn: buildWorkspaceRewriteQueue,
  })

  const rewriteLaunchMutation = useMutation({
    mutationFn: launchWorkspaceRewriteRun,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['workspace-rewrite-history'] })
      await queryClient.invalidateQueries({ queryKey: ['workspace-lineage'] })
    },
  })

  const projectStats = useMemo(() => Object.entries(reviewSummary?.projects ?? {}).sort(([a], [b]) => a.localeCompare(b)), [reviewSummary?.projects])
  const averageScore = useMemo(() => {
    const values = Object.values(scorecard?.averages ?? {}).filter((value): value is number => typeof value === 'number')
    if (!values.length) return '—'
    return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  }, [scorecard?.averages])

  const inboxStats = useMemo(() => {
    const items = allRunArticles
    const unreviewed = items.filter((item) => !item.review?.verdict).length
    const needsRewrite = items.filter((item) => item.review?.verdict === 'needs-rewrite').length
    const publishable = items.filter((item) => item.review?.verdict === 'publishable').length
    return { unreviewed, needsRewrite, publishable }
  }, [allRunArticles])

  const diffBlocks = useMemo(
    () => (diffData?.blocks ?? []).filter((block) => block.tag !== 'equal').slice(0, 8),
    [diffData?.blocks],
  )

  const { data: lineageData } = useQuery({
    queryKey: ['workspace-lineage', selectedArticlePath],
    queryFn: () => getWorkspaceLineage(selectedArticlePath),
    enabled: Boolean(selectedArticlePath),
  })

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (selectedRun) next.set('run', selectedRun)
    else next.delete('run')
    next.set('scope', scopeMode)
    if (selectedArticlePath) next.set('article', selectedArticlePath)
    else next.delete('article')
    if (projectFilter) next.set('project', projectFilter)
    else next.delete('project')
    if (verdictFilter) next.set('verdict', verdictFilter)
    else next.delete('verdict')
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [projectFilter, scopeMode, searchParams, selectedArticlePath, selectedRun, setSearchParams, verdictFilter])

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Workspace</h1>
        <p className="text-dark-400 mt-1">Review runs, work from a global editorial inbox, and compare article iterations with diff cues.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="card">
          <p className="text-sm text-dark-400">Runs</p>
          <p className="text-2xl font-bold text-white mt-1">{runs?.items?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Articles</p>
          <p className="text-2xl font-bold text-white mt-1">{articlesSource.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Filtered</p>
          <p className="text-2xl font-bold text-white mt-1">{filteredArticles.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Reviewed</p>
          <p className="text-2xl font-bold text-white mt-1">{scorecard?.review_count ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Avg Score</p>
          <p className="text-2xl font-bold text-white mt-1">{averageScore}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button className={`btn ${scopeMode === 'run' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScopeMode('run')}>
          Current Run
        </button>
        <button className={`btn ${scopeMode === 'inbox' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScopeMode('inbox')}>
          Global Inbox
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="card text-left hover:bg-dark-900/70 transition-colors" onClick={() => { setScopeMode('inbox'); setVerdictFilter('__unreviewed__') }}>
          <p className="text-sm text-dark-400">Inbox</p>
          <p className="text-2xl font-bold text-white mt-1">{inboxStats.unreviewed}</p>
          <p className="text-xs text-dark-500 mt-2">Unreviewed articles</p>
        </button>
        <button className="card text-left hover:bg-dark-900/70 transition-colors" onClick={() => { setScopeMode('inbox'); setVerdictFilter('needs-rewrite') }}>
          <p className="text-sm text-dark-400">Rewrite Queue</p>
          <p className="text-2xl font-bold text-white mt-1">{inboxStats.needsRewrite}</p>
          <p className="text-xs text-dark-500 mt-2">Needs prompt or structure fixes</p>
        </button>
        <button className="card text-left hover:bg-dark-900/70 transition-colors" onClick={() => { setScopeMode('inbox'); setVerdictFilter('publishable') }}>
          <p className="text-sm text-dark-400">Publishable</p>
          <p className="text-2xl font-bold text-white mt-1">{inboxStats.publishable}</p>
          <p className="text-xs text-dark-500 mt-2">Ready or near-ready outputs</p>
        </button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Bulk Rewrite Actions</h2>
            <p className="text-sm text-dark-400 mt-1">Build rewrite queues from quality gates and launch a rewrite lane without leaving Workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => selectedRun && rewriteQueueMutation.mutate({ run_slug: selectedRun, verdict: 'needs-rewrite', limit: 50 })}
            >
              Queue `needs-rewrite`
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => selectedRun && rewriteQueueMutation.mutate({ run_slug: selectedRun, auto_tier: 'warning', limit: 50 })}
            >
              Queue `warning`
            </button>
            <button
              className="btn btn-primary"
              onClick={() => selectedRun && rewriteQueueMutation.mutate({ run_slug: selectedRun, auto_tier: 'review', limit: 100 })}
            >
              Queue `review`
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => selectedRun && rewriteLaunchMutation.mutate({ run_slug: selectedRun, auto_tier: 'warning', limit: 50 })}
            >
              Launch `warning`
            </button>
            <button
              className="btn btn-primary"
              onClick={() => selectedRun && rewriteLaunchMutation.mutate({ run_slug: selectedRun, auto_tier: 'review', limit: 100 })}
            >
              Launch `review`
            </button>
          </div>
        </div>
        {rewriteQueueMutation.data ? (
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="text-sm font-medium text-white">Rewrite Queue Built</div>
            <div className="text-xs text-dark-300 mt-2">{rewriteQueueMutation.data.count} items</div>
            <div className="text-xs text-emerald-300 mt-1 break-all">{rewriteQueueMutation.data.queue_path}</div>
          </div>
        ) : null}
        {rewriteLaunchMutation.data ? (
          <div className="mt-4 rounded-lg border border-primary-500/20 bg-primary-500/5 p-4">
            <div className="text-sm font-medium text-white">Rewrite Lane Launched</div>
            <div className="text-xs text-dark-300 mt-2">{rewriteLaunchMutation.data.count} items</div>
            <div className="text-xs text-primary-300 mt-1 break-all">{rewriteLaunchMutation.data.queue_path}</div>
            <div className="text-xs text-primary-300 mt-1 break-all">{rewriteLaunchMutation.data.output_root}</div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <FolderTree className="w-5 h-5 text-primary-400" />
              <h2 className="text-lg font-semibold text-white">Runs</h2>
            </div>
            <div className="space-y-3 max-h-[340px] overflow-auto pr-2">
              {runs?.items?.map((run) => (
                <button
                  key={run.slug}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${selectedRun === run.slug ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                  onClick={() => {
                    setSelectedRun(run.slug)
                    setSelectedArticlePath('')
                  }}
                >
                  <div className="font-medium text-white">{run.name}</div>
                  <div className="text-sm text-dark-400 mt-1">{run.article_count} articles • {run.project_count} projects</div>
                  <div className="text-xs text-dark-500 mt-2">{formatDate(run.updated_at)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Run Scorecard</h2>
            </div>
            <div className="space-y-2 text-sm">
              {Object.entries(scorecard?.averages ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-dark-400">{scoreLabels[key] ?? key}</span>
                  <span className="text-white font-medium">{value ?? '—'}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-dark-800 space-y-2 text-sm">
              {Object.entries(scorecard?.verdicts ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-dark-400">{key}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Quality Gates</h2>
            </div>
            <div className="space-y-2 text-sm">
              {Object.entries(qualityGates?.tiers ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-dark-400">{key}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-dark-800 space-y-2 text-sm">
              {Object.entries(qualityGates?.suggested_verdicts ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-dark-400">{key}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-dark-800">
              <div className="text-sm font-medium text-white mb-3">Top flags</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(qualityGates?.top_flags ?? {}).map(([flag, count]) => (
                  <span key={flag} className="badge badge-warning">{flag}: {count}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Filters</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Project</label>
                <select className="select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                  <option value="">All projects</option>
                  {projectStats.map(([project]) => (
                    <option key={project} value={project}>{project}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Verdict</label>
                <select className="select" value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)}>
                  <option value="">All verdicts</option>
                  <option value="__unreviewed__">unreviewed</option>
                  {Object.keys(scorecard?.verdicts ?? {}).sort().map((verdict) => (
                    <option key={verdict} value={verdict}>{verdict}</option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-dark-500">
                {filteredArticles.length} of {articlesSource.length} articles shown
              </div>
            </div>
          </div>

          <div className="card">
            <div className="text-sm font-medium text-white mb-3">Per-project review state</div>
            <div className="space-y-3 max-h-[280px] overflow-auto pr-2">
              {projectStats.map(([project, bucket]) => (
                <div key={project} className="rounded-lg border border-dark-800 bg-dark-950/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white">{project}</div>
                    <div className="text-xs text-dark-500">{bucket.count} reviewed</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(bucket.verdicts).map(([verdict, count]) => (
                      <span key={verdict} className="badge badge-info">{verdict}: {count}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <FolderTree className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-semibold text-white">Rewrite History</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-dark-400">Source Articles</span>
                <span className="text-white font-medium">{rewriteHistory?.source_article_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dark-400">Rewritten Articles</span>
                <span className="text-white font-medium">{rewriteHistory?.rewritten_article_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dark-400">Descendants</span>
                <span className="text-white font-medium">{rewriteHistory?.descendant_count ?? 0}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dark-800 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-dark-400">Improved</span>
                <span className="text-emerald-300 font-medium">{rewriteHistory?.effectiveness?.improved_descendants ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dark-400">Regressed</span>
                <span className="text-rose-300 font-medium">{rewriteHistory?.effectiveness?.regressed_descendants ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dark-400">Avg Char Delta</span>
                <span className="text-white font-medium">{rewriteHistory?.effectiveness?.avg_char_delta ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dark-400">Avg Word Delta</span>
                <span className="text-white font-medium">{rewriteHistory?.effectiveness?.avg_word_delta ?? 0}</span>
              </div>
            </div>
            {rewriteHistory?.latest_descendant ? (
              <div className="mt-4 pt-4 border-t border-dark-800">
                <div className="text-sm font-medium text-white">Latest rewrite output</div>
                <button
                  className="mt-3 w-full rounded-lg border border-dark-800 bg-dark-950/50 p-3 text-left hover:bg-dark-800 transition-colors"
                  onClick={() => setComparePath(rewriteHistory.latest_descendant!.artifact_path)}
                >
                  <div className="text-sm text-white">{rewriteHistory.latest_descendant.title}</div>
                  <div className="text-xs text-dark-500 mt-1">{rewriteHistory.latest_descendant.run_name}</div>
                </button>
              </div>
            ) : null}
            <div className="mt-4 pt-4 border-t border-dark-800">
              <div className="text-sm font-medium text-white mb-3">Most rewritten sources</div>
              <div className="space-y-3 max-h-[220px] overflow-auto pr-2">
                {(rewriteHistory?.top_rewritten ?? []).length ? (
                  rewriteHistory?.top_rewritten.map((item) => (
                    <button
                      key={item.source_artifact_path}
                      className="w-full rounded-lg border border-dark-800 bg-dark-950/50 p-3 text-left hover:bg-dark-800 transition-colors"
                      onClick={() => setSelectedArticlePath(item.source_artifact_path)}
                    >
                      <div className="text-sm text-white">{item.title}</div>
                      <div className="text-xs text-dark-500 mt-1">{item.descendant_count} descendants</div>
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-dark-500">No rewrite history for this run yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[320px_1fr_1fr_420px] gap-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Articles</h2>
            </div>
            <div className="space-y-3 max-h-[960px] overflow-auto pr-2">
              {filteredArticles.map((article) => (
                <button
                  key={article.artifact_path}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${selectedArticlePath === article.artifact_path ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                  onClick={() => setSelectedArticlePath(article.artifact_path)}
                >
                  <div className="text-xs text-dark-500">{article.project} • {article.run_slug}</div>
                  <div className="font-medium text-white mt-1">{article.title}</div>
                  <div className="text-xs text-dark-500 mt-2">{article.words} words • {article.chars} chars</div>
                  {article.auto_quality?.tier ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="badge badge-warning">{article.auto_quality.tier}</span>
                      <span className="badge badge-info">{article.auto_quality.suggested_verdict}</span>
                    </div>
                  ) : null}
                  {article.review?.verdict ? (
                    <div className="mt-2">
                      <span className="badge badge-info">{article.review.verdict}</span>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-lg font-semibold text-white">Current Version</h2>
              <div className="flex items-center gap-3">
                {selectedArticle ? (
                  <Link
                    className="btn btn-secondary"
                    to={`/experiments?project=${encodeURIComponent(selectedArticle.project)}&content_title=${encodeURIComponent(selectedArticle.title)}&source_artifact_path=${encodeURIComponent(selectedArticle.artifact_path)}`}
                  >
                    Create Experiment
                  </Link>
                ) : null}
                <span className="text-xs text-dark-500 break-all">{selectedArticlePath || '—'}</span>
              </div>
            </div>
            <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[960px]">{articlePreview?.text ?? 'Select an article.'}</pre>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Columns2 className="w-5 h-5 text-primary-400" />
                <h2 className="text-lg font-semibold text-white">Compare Iterations</h2>
              </div>
              <select className="select max-w-[240px]" value={comparePath} onChange={(e) => setComparePath(e.target.value)}>
                <option value="">No compare version</option>
                {(compareCandidates?.items ?? []).map((item) => (
                  <option key={item.artifact_path} value={item.artifact_path}>
                    {item.run_name}
                  </option>
                ))}
              </select>
            </div>

            {diffData?.summary ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-dark-800 bg-dark-950/50 p-3">
                  <div className="text-xs text-dark-500">Similarity</div>
                  <div className="text-xl font-semibold text-white mt-1">{Math.round(diffData.summary.similarity_ratio * 100)}%</div>
                </div>
                <div className="rounded-lg border border-dark-800 bg-dark-950/50 p-3">
                  <div className="text-xs text-dark-500">Changed Paragraphs</div>
                  <div className="text-xl font-semibold text-white mt-1">
                    {diffData.summary.changed_left_paragraphs}/{diffData.summary.changed_right_paragraphs}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 max-h-[180px] overflow-auto pr-2">
              {(compareCandidates?.items ?? []).map((item) => (
                <button
                  key={item.artifact_path}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${comparePath === item.artifact_path ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                  onClick={() => setComparePath(item.artifact_path)}
                >
                  <div className="text-sm font-medium text-white">{item.run_name}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.words} words • {item.chars} chars</div>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-dark-800 bg-dark-950/50 p-3">
              <div className="text-sm font-medium text-white mb-3">Changed blocks</div>
              <div className="space-y-3 max-h-[220px] overflow-auto pr-2">
                {diffBlocks.length ? diffBlocks.map((block, index) => (
                  <div key={`${block.tag}-${index}`} className="rounded-lg border border-dark-800 bg-dark-950 p-3">
                    <div className="text-xs uppercase tracking-wide text-dark-500 mb-2">{block.tag}</div>
                    {block.left[0] ? <div className="text-xs text-rose-200 mb-2 whitespace-pre-wrap">{block.left[0]}</div> : null}
                    {block.right[0] ? <div className="text-xs text-emerald-200 whitespace-pre-wrap">{block.right[0]}</div> : null}
                  </div>
                )) : <div className="text-xs text-dark-500">No diff summary yet.</div>}
              </div>
            </div>

            <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[420px]">{comparePreview?.text ?? 'No comparable versions found for this article.'}</pre>

            <div className="rounded-lg border border-dark-800 bg-dark-950/50 p-3">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-sm font-medium text-white">Rewrite Lineage</div>
                <div className="text-xs text-dark-500">{lineageData?.descendant_count ?? 0} descendants • depth {lineageData?.max_depth ?? 0}</div>
              </div>
              {lineageData?.latest_descendant ? (
                <button
                  className="mb-3 w-full rounded-lg border border-primary-500/20 bg-primary-500/5 p-3 text-left hover:bg-primary-500/10 transition-colors"
                  onClick={() => setComparePath(lineageData.latest_descendant!.artifact_path)}
                >
                  <div className="text-xs text-dark-400">Latest descendant</div>
                  <div className="text-sm text-white mt-1">{lineageData.latest_descendant.title}</div>
                  <div className="text-xs text-primary-300 mt-1">{lineageData.latest_descendant.run_name}</div>
                </button>
              ) : null}
              <div className="space-y-3 max-h-[220px] overflow-auto pr-2">
                {(lineageData?.children ?? []).length ? (
                  lineageData?.children.map((item) => (
                    <button
                      key={item.artifact_path}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${comparePath === item.artifact_path ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950 hover:bg-dark-800'}`}
                      onClick={() => setComparePath(item.artifact_path)}
                    >
                      <div className="text-sm font-medium text-white">{item.run_name}</div>
                      <div className="text-xs text-dark-500 mt-1">Depth {item.depth ?? 1}</div>
                      <div className="text-xs text-dark-500 mt-1">{item.words} words • {item.chars} chars</div>
                      {item.rewrite_focus?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.rewrite_focus.slice(0, 3).map((focus) => (
                            <span key={focus} className="badge badge-warning">{focus}</span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-dark-500">No rewrite descendants found for this article yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardCheck className="w-5 h-5 text-primary-400" />
              <h2 className="text-lg font-semibold text-white">Review</h2>
            </div>
            <div className="space-y-4">
              {scoreFields.map((field) => (
                <div key={String(field)}>
                  <label className="label">{scoreLabels[String(field)]}</label>
                  <select
                    className="select"
                    value={draftReview[field] ?? ''}
                    onChange={(e) => setDraftReview((prev) => ({ ...prev, [field]: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">No score</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ))}

              <div>
                <label className="label">Verdict</label>
                <select
                  className="select"
                  value={draftReview.verdict ?? 'draft'}
                  onChange={(e) => setDraftReview((prev) => ({ ...prev, verdict: e.target.value }))}
                >
                  <option value="draft">draft</option>
                  <option value="needs-rewrite">needs-rewrite</option>
                  <option value="salvageable">salvageable</option>
                  <option value="good-base">good-base</option>
                  <option value="publishable">publishable</option>
                </select>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="textarea min-h-[240px]"
                  value={draftReview.notes ?? ''}
                  onChange={(e) => setDraftReview((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="What is wrong with this article? What should be fixed in the prompt or queue builder?"
                />
              </div>

              <button
                className="btn btn-primary w-full"
                disabled={!draftReview.artifact_path || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate(draftReview)}
              >
                <Save className="w-4 h-4" />
                Save Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
