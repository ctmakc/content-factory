import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Download,
  ExternalLink,
  FileArchive,
  Filter,
  Globe,
  Save,
  ShieldCheck,
  Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  batchPrepareExperiments,
  exportExperimentBundles,
  getExperimentCandidate,
  getExperimentBundle,
  getExperimentPayloadPreview,
  getExperimentPlatforms,
  getPublicationExperiments,
  getSecurityStatus,
  getWorkspaceRuns,
  savePublicationExperiment,
  type PublicationExperiment,
} from '../api'

const emptyExperiment: PublicationExperiment = {
  project: 'crystal.tax',
  content_title: '',
  platform: 'medium',
  status: 'planned',
  index_status: 'unknown',
  rank_status: 'not-started',
  country: 'US',
  device: 'desktop',
  source_artifact_path: '',
  canonical_url: '',
}

export default function Experiments() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState<PublicationExperiment>(emptyExperiment)
  const [tagsInput, setTagsInput] = useState('crypto tax, crypto trading, tax reporting')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [filters, setFilters] = useState({
    project: '',
    platform: '',
    status: '',
  })
  const [batchForm, setBatchForm] = useState({
    run_slug: '',
    platform: 'devto',
    project: '',
    verdict: '',
    limit: '12',
    prefer_latest_iteration: true,
  })

  const { data: experiments } = useQuery({
    queryKey: ['publication-experiments'],
    queryFn: getPublicationExperiments,
  })

  const { data: platforms } = useQuery({
    queryKey: ['experiment-platforms'],
    queryFn: getExperimentPlatforms,
  })

  const { data: runs } = useQuery({
    queryKey: ['workspace-runs'],
    queryFn: getWorkspaceRuns,
  })

  const { data: securityStatus } = useQuery({
    queryKey: ['securityStatus'],
    queryFn: getSecurityStatus,
  })

  const { data: bundle } = useQuery({
    queryKey: ['experiment-bundle', draft.id],
    queryFn: () => getExperimentBundle(draft.id!),
    enabled: !!draft.id,
  })

  const payloadMutation = useMutation({
    mutationFn: getExperimentPayloadPreview,
  })

  const candidateMutation = useMutation({
    mutationFn: ({ sourceArtifactPath, preferLatestIteration }: { sourceArtifactPath: string; preferLatestIteration: boolean }) =>
      getExperimentCandidate(sourceArtifactPath, preferLatestIteration),
  })

  const saveMutation = useMutation({
    mutationFn: savePublicationExperiment,
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['publication-experiments'] })
      if (saved?.id) {
        setDraft(saved)
        setTagsInput(saved.tags_csv ?? tagsInput)
      } else {
        setDraft(emptyExperiment)
      }
    },
  })

  const batchMutation = useMutation({
    mutationFn: batchPrepareExperiments,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['publication-experiments'] })
    },
  })

  const exportMutation = useMutation({
    mutationFn: exportExperimentBundles,
  })

  const selectedPlatform = useMemo(
    () => (platforms?.items ?? []).find((item) => item.platform === draft.platform),
    [draft.platform, platforms?.items],
  )

  const filteredExperiments = useMemo(() => {
    return (experiments?.items ?? []).filter((item) => {
      if (filters.project && item.project !== filters.project) return false
      if (filters.platform && item.platform !== filters.platform) return false
      if (filters.status && item.status !== filters.status) return false
      return true
    })
  }, [experiments?.items, filters])

  const rewriteBackedCount = useMemo(
    () => (experiments?.items ?? []).filter((item) => item.source_artifact_path?.includes('/output_runs/')).length,
    [experiments?.items],
  )

  const distinctProjects = useMemo(
    () => Array.from(new Set((experiments?.items ?? []).map((item) => item.project))).sort(),
    [experiments?.items],
  )

  const selectedCount = selectedIds.length

  useEffect(() => {
    const source = searchParams.get('source_artifact_path')
    const title = searchParams.get('content_title')
    const project = searchParams.get('project')
    const platform = searchParams.get('platform')
    if (source || title || project || platform) {
      setDraft((prev) => ({
        ...prev,
        source_artifact_path: source ?? prev.source_artifact_path,
        content_title: title ?? prev.content_title,
        project: project ?? prev.project,
        platform: platform ?? prev.platform,
      }))
      const next = new URLSearchParams(searchParams)
      next.delete('source_artifact_path')
      next.delete('content_title')
      next.delete('project')
      next.delete('platform')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!batchForm.run_slug && runs?.items?.length) {
      setBatchForm((prev) => ({ ...prev, run_slug: runs.items[0].slug }))
    }
  }, [batchForm.run_slug, runs?.items])

  function selectExperiment(item: PublicationExperiment) {
    setDraft(item)
    setTagsInput(item.tags_csv ?? tagsInput)
  }

  function toggleSelected(id?: number) {
    if (!id) return
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  function exportSelection() {
    if (!selectedIds.length) return
    exportMutation.mutate({
      experiment_ids: selectedIds,
      label: `manual-export-${new Date().toISOString().slice(0, 10)}`,
    })
  }

  const previewText =
    payloadMutation.data?.payload_pretty ??
    draft.payload_json ??
    'Generate a payload preview to see the exact JSON/variables/manual package that will be used later.'

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Experiments</h1>
        <p className="text-dark-400 mt-1">
          Prepare external syndication tests, export publish bundles, and manage indexing/rank experiments before live tokens are plugged in.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="card">
          <p className="text-sm text-dark-400">Experiments</p>
          <p className="text-2xl font-bold text-white mt-1">{experiments?.items?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Platforms</p>
          <p className="text-2xl font-bold text-white mt-1">{platforms?.items?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Indexed</p>
          <p className="text-2xl font-bold text-white mt-1">{(experiments?.items ?? []).filter((item) => item.index_status === 'indexed').length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Ready Platforms</p>
          <p className="text-2xl font-bold text-white mt-1">{(platforms?.items ?? []).filter((item) => item.readiness === 'ready').length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Rewrite-Backed</p>
          <p className="text-2xl font-bold text-white mt-1">{rewriteBackedCount}</p>
        </div>
        <div className={`card ${securityStatus?.crypto.using_default_secret ? 'border-amber-500/30' : 'border-emerald-500/20'}`}>
          <p className="text-sm text-dark-400">Secret Storage</p>
          <p className="text-2xl font-bold text-white mt-1">{securityStatus?.crypto.using_default_secret ? 'Dev' : 'Custom'}</p>
        </div>
      </div>

      <div className={`card ${securityStatus?.crypto.using_default_secret ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 mt-0.5 text-primary-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Security & Adapter Readiness</h2>
              <p className="text-sm text-dark-300 mt-1">
                Keys already store encrypted at rest. This panel shows whether the backend still uses the built-in development secret and how close each adapter is to being live.
              </p>
            </div>
          </div>
          <span className={`badge ${securityStatus?.crypto.using_default_secret ? 'badge-warning' : 'badge-success'}`}>
            {securityStatus?.crypto.using_default_secret ? 'dev secret' : 'custom secret'}
          </span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-5">
          {(platforms?.items ?? []).map((item) => (
            <div key={item.platform} className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">{item.label}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.publish_mode}</div>
                </div>
                <span className="badge badge-info">{item.readiness}</span>
              </div>
              <p className="text-sm text-dark-300 mt-3">{item.notes}</p>
              <div className="mt-3 space-y-2">
                {item.steps.map((step, index) => (
                  <div key={step} className="text-xs text-dark-400">
                    {index + 1}. {step}
                  </div>
                ))}
              </div>
              {item.docs_url ? (
                <a className="inline-flex items-center gap-1 text-xs text-primary-400 mt-4 hover:text-primary-300" href={item.docs_url} target="_blank" rel="noreferrer">
                  Docs <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">Batch Preparation</h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div>
            <label className="label">Run</label>
            <select className="select" value={batchForm.run_slug} onChange={(e) => setBatchForm((prev) => ({ ...prev, run_slug: e.target.value }))}>
              {(runs?.items ?? []).map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Platform</label>
            <select className="select" value={batchForm.platform} onChange={(e) => setBatchForm((prev) => ({ ...prev, platform: e.target.value }))}>
              <option value="devto">DEV.to</option>
              <option value="hashnode">Hashnode</option>
              <option value="medium">Medium</option>
            </select>
          </div>
          <div>
            <label className="label">Project Filter</label>
            <input className="input" value={batchForm.project} onChange={(e) => setBatchForm((prev) => ({ ...prev, project: e.target.value }))} placeholder="optional" />
          </div>
          <div>
            <label className="label">Verdict Filter</label>
            <select className="select" value={batchForm.verdict} onChange={(e) => setBatchForm((prev) => ({ ...prev, verdict: e.target.value }))}>
              <option value="">all</option>
              <option value="publishable">publishable</option>
              <option value="good-base">good-base</option>
              <option value="needs-rewrite">needs-rewrite</option>
              <option value="__unreviewed__">unreviewed</option>
            </select>
          </div>
          <div>
            <label className="label">Limit</label>
            <input className="input" value={batchForm.limit} onChange={(e) => setBatchForm((prev) => ({ ...prev, limit: e.target.value }))} />
          </div>
        </div>
        <label className="mt-4 inline-flex items-center gap-3 text-sm text-dark-300">
          <input
            type="checkbox"
            checked={batchForm.prefer_latest_iteration}
            onChange={(e) => setBatchForm((prev) => ({ ...prev, prefer_latest_iteration: e.target.checked }))}
          />
          Prefer latest approved rewrite iteration when available
        </label>
        <div className="mt-4 flex items-center gap-4">
          <button
            className="btn btn-primary"
            onClick={() =>
              batchMutation.mutate({
                run_slug: batchForm.run_slug,
                platform: batchForm.platform,
                project: batchForm.project || undefined,
                verdict: batchForm.verdict || undefined,
                limit: Number(batchForm.limit || 12),
                tags: tagsInput.split(',').map((item) => item.trim()).filter(Boolean),
                prefer_latest_iteration: batchForm.prefer_latest_iteration,
              })
            }
          >
            <Wand2 className="w-4 h-4" />
            Prepare Batch
          </button>
          <div className="text-xs text-dark-500">
            Creates planned experiments with saved payload snapshots, without publishing yet.
          </div>
        </div>
        {batchMutation.data ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-dark-800 bg-dark-950/50 p-4">
              <div className="text-sm font-medium text-white">Created</div>
              <div className="text-2xl font-bold text-white mt-1">{batchMutation.data.created.length}</div>
              <div className="text-xs text-dark-500 mt-2">
                rewrite-backed: {batchMutation.data.created.filter((item) => item.source_artifact_path?.includes('/output_runs/')).length}
              </div>
            </div>
            <div className="rounded-lg border border-dark-800 bg-dark-950/50 p-4">
              <div className="text-sm font-medium text-white">Skipped</div>
              <div className="text-2xl font-bold text-white mt-1">{batchMutation.data.skipped.length}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[480px_1fr_1fr] gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white">Experiment Workbench</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Project</label>
              <input className="input" value={draft.project} onChange={(e) => setDraft((prev) => ({ ...prev, project: e.target.value }))} />
            </div>
            <div>
              <label className="label">Content Title</label>
              <input className="input" value={draft.content_title} onChange={(e) => setDraft((prev) => ({ ...prev, content_title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Source Artifact Path</label>
              <input className="input" value={draft.source_artifact_path ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, source_artifact_path: e.target.value }))} />
            </div>
            <button
              className="btn btn-secondary w-full"
              disabled={!draft.source_artifact_path}
              onClick={() =>
                draft.source_artifact_path &&
                candidateMutation.mutate({
                  sourceArtifactPath: draft.source_artifact_path,
                  preferLatestIteration: true,
                })
              }
            >
              <Wand2 className="w-4 h-4" />
              Resolve Best Candidate
            </button>
            <div>
              <label className="label">Platform</label>
              <select className="select" value={draft.platform} onChange={(e) => setDraft((prev) => ({ ...prev, platform: e.target.value }))}>
                <option value="medium">Medium</option>
                <option value="devto">DEV.to</option>
                <option value="hashnode">Hashnode</option>
                <option value="substack">Substack</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Canonical / Original URL</label>
              <input className="input" value={draft.canonical_url ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, canonical_url: e.target.value }))} />
            </div>
            <div>
              <label className="label">Published URL</label>
              <input className="input" value={draft.published_url ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, published_url: e.target.value }))} />
            </div>
            <div>
              <label className="label">Target Query</label>
              <input className="input" value={draft.target_query ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, target_query: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tags</label>
              <input className="input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <select className="select" value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="planned">planned</option>
                  <option value="posted">posted</option>
                  <option value="indexed">indexed</option>
                  <option value="measuring">measuring</option>
                  <option value="done">done</option>
                </select>
              </div>
              <div>
                <label className="label">Index Status</label>
                <select className="select" value={draft.index_status ?? 'unknown'} onChange={(e) => setDraft((prev) => ({ ...prev, index_status: e.target.value }))}>
                  <option value="unknown">unknown</option>
                  <option value="submitted">submitted</option>
                  <option value="discovered">discovered</option>
                  <option value="indexed">indexed</option>
                  <option value="excluded">excluded</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Rank Status</label>
                <select className="select" value={draft.rank_status ?? 'not-started'} onChange={(e) => setDraft((prev) => ({ ...prev, rank_status: e.target.value }))}>
                  <option value="not-started">not-started</option>
                  <option value="baseline-captured">baseline-captured</option>
                  <option value="tracking">tracking</option>
                  <option value="stable">stable</option>
                </select>
              </div>
              <div>
                <label className="label">Latest Rank</label>
                <input className="input" value={draft.latest_rank ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, latest_rank: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="textarea min-h-[140px]" value={draft.notes ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <button
                className="btn btn-secondary w-full"
                onClick={() =>
                  payloadMutation.mutate({
                    platform: draft.platform,
                    source_artifact_path: draft.source_artifact_path,
                    content_title: draft.content_title,
                    canonical_url: draft.canonical_url,
                    published_url: draft.published_url,
                    tags: tagsInput.split(',').map((item) => item.trim()).filter(Boolean),
                    prefer_latest_iteration: true,
                  })
                }
              >
                <Wand2 className="w-4 h-4" />
                Build Payload
              </button>
              <button
                className="btn btn-primary w-full"
                onClick={() => saveMutation.mutate({ ...draft, tags_csv: tagsInput })}
              >
                <Save className="w-4 h-4" />
                Save Experiment
              </button>
            </div>
            {draft.id ? (
              <button className="btn btn-ghost w-full" onClick={() => setDraft(emptyExperiment)}>
                New Experiment
              </button>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Payload & Bundle Preview</h2>
          </div>
          <div className="text-xs text-dark-500 mb-3">
            {selectedPlatform ? `${selectedPlatform.label} • ${selectedPlatform.readiness}` : 'Choose a platform'}
          </div>
          <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[320px] rounded-lg border border-dark-800 bg-dark-950/40 p-4">
            {previewText}
          </pre>
          {(payloadMutation.data?.resolved_candidate || candidateMutation.data) ? (
            <div className="mt-5 rounded-lg border border-primary-500/20 bg-primary-500/5 p-4">
              <div className="text-sm font-medium text-white">Resolved Publish Candidate</div>
              <div className="text-xs text-dark-300 mt-2 break-all">
                {(payloadMutation.data?.resolved_candidate ?? candidateMutation.data)?.selected_artifact_path}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="badge badge-info">
                  {(payloadMutation.data?.resolved_candidate ?? candidateMutation.data)?.selected_kind}
                </span>
                {(payloadMutation.data?.resolved_candidate ?? candidateMutation.data)?.selected_review_verdict ? (
                  <span className="badge badge-warning">
                    {(payloadMutation.data?.resolved_candidate ?? candidateMutation.data)?.selected_review_verdict}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-2 max-h-[180px] overflow-auto pr-1">
                {((payloadMutation.data?.resolved_candidate ?? candidateMutation.data)?.candidates ?? []).slice(0, 4).map((item) => (
                  <div key={item.artifact_path} className="rounded-lg border border-dark-800 bg-dark-950/40 p-3">
                    <div className="text-xs text-white">{item.title}</div>
                    <div className="text-[11px] text-dark-500 mt-1">
                      {item.kind} {item.run_name ? `• ${item.run_name}` : ''} • {item.words} words
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {bundle ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-dark-800 bg-dark-950/40 p-4">
                <div className="flex items-center gap-2 text-white font-medium">
                  <FileArchive className="w-4 h-4 text-primary-400" />
                  Export Bundle
                </div>
                <div className="text-xs text-dark-500 mt-2">
                  {bundle.suggested_files.article_markdown} • {bundle.suggested_files.payload_json} • {bundle.suggested_files.notes_markdown}
                </div>
                <div className="space-y-2 mt-4">
                  {bundle.checklist.map((item, index) => (
                    <div key={item} className="text-sm text-dark-300">
                      {index + 1}. {item}
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <button
                    className="btn btn-secondary"
                    onClick={() => draft.id && exportMutation.mutate({ experiment_ids: [draft.id], label: `single-${draft.platform}` })}
                  >
                    <Download className="w-4 h-4" />
                    Export This Bundle
                  </button>
                </div>
              </div>
              {bundle.resolved_candidate ? (
                <div className="rounded-lg border border-dark-800 bg-dark-950/40 p-4">
                  <div className="text-sm font-medium text-white">Bundle Candidate Resolution</div>
                  <div className="text-xs text-dark-400 mt-2 break-all">{bundle.resolved_candidate.selected_artifact_path}</div>
                  <div className="text-xs text-dark-500 mt-2">
                    selected from {bundle.resolved_candidate.candidates.length} candidate version(s)
                  </div>
                </div>
              ) : null}
              <div className="rounded-lg border border-dark-800 bg-dark-950/40 p-4">
                <div className="text-sm font-medium text-white">Article Body Preview</div>
                <pre className="mt-3 text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[320px]">
                  {bundle.body_markdown || 'No source markdown attached yet.'}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-xs text-dark-500 mt-4">
              Save or select an existing experiment to unlock bundle export and publish notes.
            </div>
          )}
          {exportMutation.data?.root ? (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-sm font-medium text-white">Bundles Exported</div>
              <div className="text-xs text-dark-300 mt-2">{exportMutation.data.count} bundle(s) written to:</div>
              <div className="text-xs text-emerald-300 mt-1 break-all">{exportMutation.data.root}</div>
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Experiment Log</h2>
            </div>
            <button className="btn btn-secondary" disabled={!selectedCount} onClick={exportSelection}>
              <Download className="w-4 h-4" />
              Export Selected ({selectedCount})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label">Project</label>
              <select className="select" value={filters.project} onChange={(e) => setFilters((prev) => ({ ...prev, project: e.target.value }))}>
                <option value="">all</option>
                {distinctProjects.map((project) => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Platform</label>
              <select className="select" value={filters.platform} onChange={(e) => setFilters((prev) => ({ ...prev, platform: e.target.value }))}>
                <option value="">all</option>
                <option value="devto">DEV.to</option>
                <option value="hashnode">Hashnode</option>
                <option value="medium">Medium</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">all</option>
                <option value="planned">planned</option>
                <option value="posted">posted</option>
                <option value="indexed">indexed</option>
                <option value="measuring">measuring</option>
                <option value="done">done</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-dark-500 mb-3">
            <Filter className="w-3 h-3" />
            {filteredExperiments.length} filtered experiment(s)
          </div>

          <div className="space-y-3 max-h-[900px] overflow-auto pr-2">
            {filteredExperiments.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-4 ${draft.id === item.id ? 'border-primary-500/40 bg-primary-500/5' : 'border-dark-800 bg-dark-950/50'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!item.id && selectedIds.includes(item.id)}
                    onChange={() => toggleSelected(item.id)}
                  />
                  <button className="flex-1 text-left" onClick={() => selectExperiment(item)}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{item.content_title}</div>
                        <div className="text-xs text-dark-500 mt-1">{item.project} • {item.platform}</div>
                      </div>
                      <span className="badge badge-info">{item.status}</span>
                    </div>
                    <div className="text-xs text-dark-500 mt-2">
                      query: {item.target_query || '—'} • index: {item.index_status || '—'} • rank: {item.latest_rank || '—'}
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
