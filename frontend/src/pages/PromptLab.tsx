import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Beaker, BookMarked, Play, Save, Sparkles, TestTube2, Trophy } from 'lucide-react'
import {
  getOpsFile,
  getPromptLabLeaderboard,
  launchPromptLabBattle,
  getPromptLabAssets,
  getPromptLabTestCases,
  savePromptLabAsset,
  savePromptLabTestCase,
  type PromptAssetProfile,
  type PromptLabAsset,
  type PromptLabTestCase,
  type PromptTestCaseProfile,
} from '../api'

function assetProfileDraft(asset?: PromptLabAsset | null): PromptAssetProfile {
  return {
    asset_key: asset?.key ?? '',
    project: asset?.profile?.project ?? 'crystal.tax',
    label: asset?.profile?.label ?? asset?.label ?? '',
    status: asset?.profile?.status ?? 'draft',
    tier: asset?.profile?.tier ?? '',
    tags_csv: asset?.profile?.tags_csv ?? '',
    notes: asset?.profile?.notes ?? '',
    default_for_project: asset?.profile?.default_for_project ?? false,
    linked_test_case_slug: asset?.profile?.linked_test_case_slug ?? asset?.battle_slug ?? '',
  }
}

function caseProfileDraft(item?: PromptLabTestCase | null): PromptTestCaseProfile {
  return {
    slug: item?.slug ?? '',
    project: item?.profile?.project ?? 'crystal.tax',
    title: item?.profile?.title ?? item?.topic ?? '',
    status: item?.profile?.status ?? 'active',
    notes: item?.profile?.notes ?? '',
    priority: item?.profile?.priority ?? 'normal',
    tags_csv: item?.profile?.tags_csv ?? '',
    target_model: item?.profile?.target_model ?? item?.model ?? '',
  }
}

export default function PromptLab() {
  const queryClient = useQueryClient()
  const [selectedAssetKey, setSelectedAssetKey] = useState('')
  const [selectedCaseSlug, setSelectedCaseSlug] = useState('')
  const [launcherSelectedKeys, setLauncherSelectedKeys] = useState<string[]>([])
  const [assetFilter, setAssetFilter] = useState({
    project: '',
    status: '',
    kind: '',
  })
  const [assetDraft, setAssetDraft] = useState<PromptAssetProfile>(assetProfileDraft())
  const [caseDraft, setCaseDraft] = useState<PromptTestCaseProfile>(caseProfileDraft())

  const { data: assetsData } = useQuery({
    queryKey: ['promptlab-assets'],
    queryFn: getPromptLabAssets,
  })

  const { data: casesData } = useQuery({
    queryKey: ['promptlab-test-cases'],
    queryFn: getPromptLabTestCases,
  })

  const { data: leaderboardData } = useQuery({
    queryKey: ['promptlab-leaderboard'],
    queryFn: () => getPromptLabLeaderboard('crystal.tax'),
  })

  const selectedAsset = useMemo(
    () => (assetsData?.items ?? []).find((item) => item.key === selectedAssetKey) ?? null,
    [assetsData?.items, selectedAssetKey],
  )
  const selectedCase = useMemo(
    () => (casesData?.items ?? []).find((item) => item.slug === selectedCaseSlug) ?? null,
    [casesData?.items, selectedCaseSlug],
  )

  useEffect(() => {
    if (!selectedAssetKey && assetsData?.items?.length) {
      setSelectedAssetKey(assetsData.items[0].key)
    }
  }, [assetsData?.items, selectedAssetKey])

  useEffect(() => {
    if (!selectedCaseSlug && casesData?.items?.length) {
      setSelectedCaseSlug(casesData.items[0].slug)
    }
  }, [casesData?.items, selectedCaseSlug])

  useEffect(() => {
    setAssetDraft(assetProfileDraft(selectedAsset))
  }, [selectedAsset])

  useEffect(() => {
    setCaseDraft(caseProfileDraft(selectedCase))
  }, [selectedCase])

  const { data: promptPreview } = useQuery({
    queryKey: ['promptlab-preview', selectedAsset?.path],
    queryFn: () => getOpsFile(selectedAsset!.path),
    enabled: Boolean(selectedAsset?.path),
  })

  const saveAssetMutation = useMutation({
    mutationFn: savePromptLabAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promptlab-assets'] })
    },
  })

  const saveCaseMutation = useMutation({
    mutationFn: savePromptLabTestCase,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promptlab-test-cases'] })
    },
  })

  const launchBattleMutation = useMutation({
    mutationFn: launchPromptLabBattle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prompt-battles'] })
      await queryClient.invalidateQueries({ queryKey: ['promptlab-test-cases'] })
    },
  })

  const filteredAssets = useMemo(() => {
    return (assetsData?.items ?? []).filter((item) => {
      if (assetFilter.project && (item.profile?.project ?? '') !== assetFilter.project) return false
      if (assetFilter.status && (item.profile?.status ?? '') !== assetFilter.status) return false
      if (assetFilter.kind && item.kind !== assetFilter.kind) return false
      return true
    })
  }, [assetFilter, assetsData?.items])

  const launchableAssets = useMemo(
    () => (assetsData?.items ?? []).filter((item) => item.kind === 'battle-prompt' && item.prompt_role === 'user'),
    [assetsData?.items],
  )

  useEffect(() => {
    if (!launcherSelectedKeys.length && launchableAssets.length) {
      setLauncherSelectedKeys(launchableAssets.slice(0, 3).map((item) => item.key))
    }
  }, [launchableAssets, launcherSelectedKeys.length])

  function toggleLaunchAsset(key: string) {
    setLauncherSelectedKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Prompt Lab</h1>
        <p className="text-dark-400 mt-1">Manage prompt lifecycle, promote defaults by project, and keep reusable battle test cases under control.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-dark-400">Prompt Assets</p>
          <p className="text-2xl font-bold text-white mt-1">{assetsData?.items?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Test Cases</p>
          <p className="text-2xl font-bold text-white mt-1">{casesData?.items?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Promoted</p>
          <p className="text-2xl font-bold text-white mt-1">{(assetsData?.items ?? []).filter((item) => item.profile?.status === 'promoted').length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Project Defaults</p>
          <p className="text-2xl font-bold text-white mt-1">{(assetsData?.items ?? []).filter((item) => item.profile?.default_for_project).length}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Aggregate Leaderboard</h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {(leaderboardData?.items ?? []).slice(0, 6).map((item) => (
            <div key={item.asset_key} className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{item.profile?.label || item.asset?.label || item.candidate_name}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.project || 'unassigned project'}</div>
                </div>
                <span className="badge badge-info">{item.average_score ?? '—'}</span>
              </div>
              <div className="text-xs text-dark-400 mt-3">
                battles: {item.battle_count} • wins: {item.winner_count}
              </div>
              <div className="text-xs text-dark-500 mt-2">
                {(item.battle_slugs || []).slice(0, 3).join(', ')}
              </div>
            </div>
          ))}
          {!leaderboardData?.items?.length ? (
            <div className="text-sm text-dark-500">No aggregate scores yet. Save more battle evaluations and the leaderboard will start filling in.</div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Battle Launcher</h2>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
              <div className="space-y-3 max-h-[360px] overflow-auto pr-2">
                {(casesData?.items ?? []).map((item) => (
                  <button
                    key={item.slug}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedCaseSlug === item.slug ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                    onClick={() => setSelectedCaseSlug(item.slug)}
                  >
                    <div className="text-sm font-medium text-white">{item.topic}</div>
                    <div className="text-xs text-dark-500 mt-1">{item.slug}</div>
                    <div className="text-xs text-dark-500 mt-1">{item.model} • {item.language}</div>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
                  <div className="text-sm font-medium text-white mb-3">Select Prompt Assets</div>
                  <div className="space-y-2 max-h-[220px] overflow-auto pr-2">
                    {launchableAssets.map((item) => (
                      <label key={item.key} className="flex items-start gap-3 rounded-lg border border-dark-800 bg-dark-950 p-3 text-sm text-dark-200">
                        <input type="checkbox" checked={launcherSelectedKeys.includes(item.key)} onChange={() => toggleLaunchAsset(item.key)} />
                        <div>
                          <div className="font-medium text-white">{item.label}</div>
                          <div className="text-xs text-dark-500 mt-1">{item.group}</div>
                          {item.evaluation?.overall_score != null ? (
                            <div className="text-xs text-emerald-300 mt-1">score {item.evaluation.overall_score}</div>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="btn btn-primary"
                    disabled={!selectedCaseSlug || launcherSelectedKeys.length === 0 || launchBattleMutation.isPending}
                    onClick={() =>
                      launchBattleMutation.mutate({
                        test_case_slug: selectedCaseSlug,
                        asset_keys: launcherSelectedKeys,
                        auto_start: true,
                      })
                    }
                  >
                    <Play className="w-4 h-4" />
                    Launch Battle
                  </button>
                  <div className="text-xs text-dark-500">
                    Creates a fresh battle directory under `/data/QWEN/prompt_battle` and starts the run immediately.
                  </div>
                </div>
                {launchBattleMutation.data ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="text-sm font-medium text-white">Battle Launched</div>
                    <div className="text-xs text-dark-300 mt-2">{launchBattleMutation.data.slug}</div>
                    <div className="text-xs text-emerald-300 mt-1 break-all">{launchBattleMutation.data.path}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <BookMarked className="w-5 h-5 text-primary-400" />
              <h2 className="text-lg font-semibold text-white">Prompt Assets</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="label">Project</label>
                <select className="select" value={assetFilter.project} onChange={(e) => setAssetFilter((prev) => ({ ...prev, project: e.target.value }))}>
                  <option value="">all</option>
                  <option value="crystal.tax">crystal.tax</option>
                  <option value="mmix.ua">mmix.ua</option>
                  <option value="cookiddoo.com">cookiddoo.com</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={assetFilter.status} onChange={(e) => setAssetFilter((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="">all</option>
                  <option value="draft">draft</option>
                  <option value="tested">tested</option>
                  <option value="promoted">promoted</option>
                  <option value="retired">retired</option>
                </select>
              </div>
              <div>
                <label className="label">Kind</label>
                <select className="select" value={assetFilter.kind} onChange={(e) => setAssetFilter((prev) => ({ ...prev, kind: e.target.value }))}>
                  <option value="">all</option>
                  <option value="battle-prompt">battle-prompt</option>
                  <option value="prompt-file">prompt-file</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
              <div className="space-y-3 max-h-[760px] overflow-auto pr-2">
                {filteredAssets.map((item) => (
                  <button
                    key={item.key}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedAssetKey === item.key ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                    onClick={() => setSelectedAssetKey(item.key)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <div className="text-xs text-dark-500 mt-1">{item.kind} • {item.prompt_role ?? item.group}</div>
                      </div>
                      {item.profile?.default_for_project ? <Sparkles className="w-4 h-4 text-amber-400" /> : null}
                    </div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {item.profile?.status ? <span className="badge badge-info">{item.profile.status}</span> : null}
                      {item.evaluation?.verdict ? <span className="badge badge-info">{item.evaluation.verdict}</span> : null}
                      {item.evaluation?.overall_score != null ? <span className="badge badge-info">score {item.evaluation.overall_score}</span> : null}
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
                  <div className="text-sm font-medium text-white mb-3">Prompt Preview</div>
                  <div className="text-xs text-dark-500 mb-3 break-all">{selectedAsset?.path ?? 'Select a prompt asset.'}</div>
                  <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[360px]">
                    {promptPreview?.text ?? 'No prompt selected.'}
                  </pre>
                </div>

                <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Beaker className="w-4 h-4 text-emerald-400" />
                    <div className="text-sm font-medium text-white">Lifecycle Metadata</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Project</label>
                      <input className="input" value={assetDraft.project ?? ''} onChange={(e) => setAssetDraft((prev) => ({ ...prev, project: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Label</label>
                      <input className="input" value={assetDraft.label ?? ''} onChange={(e) => setAssetDraft((prev) => ({ ...prev, label: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Status</label>
                      <select className="select" value={assetDraft.status} onChange={(e) => setAssetDraft((prev) => ({ ...prev, status: e.target.value }))}>
                        <option value="draft">draft</option>
                        <option value="tested">tested</option>
                        <option value="promoted">promoted</option>
                        <option value="retired">retired</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Tier</label>
                      <select className="select" value={assetDraft.tier ?? ''} onChange={(e) => setAssetDraft((prev) => ({ ...prev, tier: e.target.value }))}>
                        <option value="">none</option>
                        <option value="core">core</option>
                        <option value="experimental">experimental</option>
                        <option value="premium">premium</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Linked Test Case</label>
                      <select className="select" value={assetDraft.linked_test_case_slug ?? ''} onChange={(e) => setAssetDraft((prev) => ({ ...prev, linked_test_case_slug: e.target.value }))}>
                        <option value="">none</option>
                        {(casesData?.items ?? []).map((item) => (
                          <option key={item.slug} value={item.slug}>{item.slug}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Tags</label>
                    <input className="input" value={assetDraft.tags_csv ?? ''} onChange={(e) => setAssetDraft((prev) => ({ ...prev, tags_csv: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-3 text-sm text-dark-200">
                    <input type="checkbox" checked={Boolean(assetDraft.default_for_project)} onChange={(e) => setAssetDraft((prev) => ({ ...prev, default_for_project: e.target.checked }))} />
                    Default prompt for this project
                  </label>
                  <div>
                    <label className="label">Notes</label>
                    <textarea className="textarea min-h-[140px]" value={assetDraft.notes ?? ''} onChange={(e) => setAssetDraft((prev) => ({ ...prev, notes: e.target.value }))} />
                  </div>
                  <button
                    className="btn btn-primary w-full"
                    disabled={!assetDraft.asset_key || saveAssetMutation.isPending}
                    onClick={() => saveAssetMutation.mutate(assetDraft)}
                  >
                    <Save className="w-4 h-4" />
                    Save Prompt Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TestTube2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Reusable Test Cases</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-3 max-h-[340px] overflow-auto pr-2">
              {(casesData?.items ?? []).map((item) => (
                <button
                  key={item.slug}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedCaseSlug === item.slug ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                  onClick={() => setSelectedCaseSlug(item.slug)}
                >
                  <div className="text-sm font-medium text-white">{item.topic}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.slug}</div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {item.profile?.status ? <span className="badge badge-info">{item.profile.status}</span> : null}
                    {item.profile?.priority ? <span className="badge badge-info">{item.profile.priority}</span> : null}
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4 space-y-4">
              <div className="text-sm font-medium text-white">Test Case Metadata</div>
              <div>
                <label className="label">Project</label>
                <input className="input" value={caseDraft.project ?? ''} onChange={(e) => setCaseDraft((prev) => ({ ...prev, project: e.target.value }))} />
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input" value={caseDraft.title ?? ''} onChange={(e) => setCaseDraft((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Status</label>
                  <select className="select" value={caseDraft.status} onChange={(e) => setCaseDraft((prev) => ({ ...prev, status: e.target.value }))}>
                    <option value="active">active</option>
                    <option value="reviewing">reviewing</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="select" value={caseDraft.priority ?? 'normal'} onChange={(e) => setCaseDraft((prev) => ({ ...prev, priority: e.target.value }))}>
                    <option value="low">low</option>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Target Model</label>
                <input className="input" value={caseDraft.target_model ?? ''} onChange={(e) => setCaseDraft((prev) => ({ ...prev, target_model: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tags</label>
                <input className="input" value={caseDraft.tags_csv ?? ''} onChange={(e) => setCaseDraft((prev) => ({ ...prev, tags_csv: e.target.value }))} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="textarea min-h-[160px]" value={caseDraft.notes ?? ''} onChange={(e) => setCaseDraft((prev) => ({ ...prev, notes: e.target.value }))} />
              </div>
              <button
                className="btn btn-primary w-full"
                disabled={!caseDraft.slug || saveCaseMutation.isPending}
                onClick={() => saveCaseMutation.mutate(caseDraft)}
              >
                <Save className="w-4 h-4" />
                Save Test Case
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
