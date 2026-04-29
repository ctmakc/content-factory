import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, BookOpen, FileCode2, FileText, FlaskConical, Layers3, Play, Save, TerminalSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  activatePromptLabAsset,
  getPromptLabAssets,
  getBattleTestCases,
  getOpsFile,
  getPromptBattle,
  getPromptBattles,
  getPromptRegistry,
  savePromptLabAsset,
  savePromptBattleEvaluation,
  startPromptBattle,
  type PromptBattleEvaluation,
} from '../api'

const scoreFields: Array<keyof PromptBattleEvaluation> = [
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

export default function Battles() {
  const queryClient = useQueryClient()
  const [selectedBattle, setSelectedBattle] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [selectedRegistryPath, setSelectedRegistryPath] = useState('')
  const [draftEvaluation, setDraftEvaluation] = useState<PromptBattleEvaluation>({
    battle_slug: '',
    candidate_name: '',
  })

  const { data: battles } = useQuery({
    queryKey: ['prompt-battles'],
    queryFn: getPromptBattles,
  })

  useEffect(() => {
    if (!selectedBattle && battles?.items?.length) {
      setSelectedBattle(battles.items[0].slug)
    }
  }, [battles?.items, selectedBattle])

  const { data: battleDetail } = useQuery({
    queryKey: ['prompt-battle', selectedBattle],
    queryFn: () => getPromptBattle(selectedBattle),
    enabled: Boolean(selectedBattle),
    refetchInterval: 5000,
  })

  const { data: promptRegistry } = useQuery({
    queryKey: ['prompt-registry'],
    queryFn: getPromptRegistry,
  })

  const { data: testCases } = useQuery({
    queryKey: ['battle-test-cases'],
    queryFn: getBattleTestCases,
  })

  const { data: promptLabAssets } = useQuery({
    queryKey: ['promptlab-assets'],
    queryFn: getPromptLabAssets,
  })

  useEffect(() => {
    if (!selectedCandidate && battleDetail?.candidates?.length) {
      setSelectedCandidate(battleDetail.candidates[0].name)
    }
  }, [battleDetail?.candidates, selectedCandidate])

  const activeCandidate = battleDetail?.candidates?.find((item) => item.name === selectedCandidate)
  useEffect(() => {
    if (activeCandidate && selectedBattle) {
      setDraftEvaluation({
        battle_slug: selectedBattle,
        candidate_name: activeCandidate.name,
        article_path: activeCandidate.result?.article_path ?? null,
        usefulness_score: activeCandidate.evaluation?.usefulness_score ?? null,
        seo_score: activeCandidate.evaluation?.seo_score ?? null,
        geo_score: activeCandidate.evaluation?.geo_score ?? null,
        human_score: activeCandidate.evaluation?.human_score ?? null,
        brand_fit_score: activeCandidate.evaluation?.brand_fit_score ?? null,
        safety_score: activeCandidate.evaluation?.safety_score ?? null,
        verdict: activeCandidate.evaluation?.verdict ?? 'draft',
        notes: activeCandidate.evaluation?.notes ?? '',
        is_winner: activeCandidate.evaluation?.is_winner ?? false,
      })
    }
  }, [activeCandidate, selectedBattle])

  const { data: articlePreview } = useQuery({
    queryKey: ['battle-article', activeCandidate?.result?.article_path],
    queryFn: () => getOpsFile(activeCandidate!.result!.article_path),
    enabled: Boolean(activeCandidate?.result?.article_path),
  })

  const { data: userPromptPreview } = useQuery({
    queryKey: ['battle-user-prompt', activeCandidate?.user_prompt],
    queryFn: () => getOpsFile(activeCandidate!.user_prompt),
    enabled: Boolean(activeCandidate?.user_prompt),
  })

  const { data: systemPromptPreview } = useQuery({
    queryKey: ['battle-system-prompt', activeCandidate?.system_prompt],
    queryFn: () => getOpsFile(activeCandidate!.system_prompt!),
    enabled: Boolean(activeCandidate?.system_prompt),
  })

  useEffect(() => {
    if (!selectedRegistryPath && activeCandidate?.user_prompt) {
      setSelectedRegistryPath(activeCandidate.user_prompt)
    }
  }, [activeCandidate?.user_prompt, selectedRegistryPath])

  const { data: registryPreview } = useQuery({
    queryKey: ['prompt-registry-file', selectedRegistryPath],
    queryFn: () => getOpsFile(selectedRegistryPath),
    enabled: Boolean(selectedRegistryPath),
  })

  const startMutation = useMutation({
    mutationFn: startPromptBattle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prompt-battles'] })
      await queryClient.invalidateQueries({ queryKey: ['prompt-battle', selectedBattle] })
    },
  })

  const evaluationMutation = useMutation({
    mutationFn: (data: PromptBattleEvaluation) => savePromptBattleEvaluation(selectedBattle, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prompt-battle', selectedBattle] })
    },
  })

  const promoteMutation = useMutation({
    mutationFn: savePromptLabAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promptlab-assets'] })
    },
  })

  const activateMutation = useMutation({
    mutationFn: activatePromptLabAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-prompt', 'seo_article_system.txt'] })
    },
  })

  const winnerName = battleDetail?.candidates?.find((item) => item.evaluation?.is_winner)?.name
  const registryItems = (promptRegistry?.items ?? []).filter((item) => {
    if (!selectedBattle) return true
    return item.battle_slug === selectedBattle || item.kind === 'prompt-file'
  })
  const activePromptAssetKey = activeCandidate ? `${selectedBattle}:${activeCandidate.name}:user_prompt` : ''
  const activePromptProfile = (promptLabAssets?.items ?? []).find((item) => item.key === activePromptAssetKey)?.profile

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Prompt Battles</h1>
        <p className="text-dark-400 mt-1">Compare prompt candidates, inspect generated drafts, and save explicit winner decisions.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white">Battles</h2>
          </div>
          <div className="space-y-3">
            {battles?.items?.map((battle) => (
              <button
                key={battle.slug}
                className={`w-full text-left rounded-lg border p-4 transition-colors ${selectedBattle === battle.slug ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                onClick={() => {
                  setSelectedBattle(battle.slug)
                  setSelectedCandidate('')
                }}
              >
                <div className="font-medium text-white">{battle.slug}</div>
                <div className="text-sm text-dark-400 mt-1">{battle.topic}</div>
                <div className="text-xs text-dark-500 mt-2">
                  {battle.model} • {battle.language} • {battle.result_count}/{battle.candidate_count}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{battleDetail?.manifest?.topic ?? 'Battle details'}</h2>
                <p className="text-sm text-dark-400 mt-1">{battleDetail?.manifest?.model} • {battleDetail?.manifest?.language}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`badge ${battleDetail?.run_state?.running ? 'badge-warning' : 'badge-info'}`}>
                  {battleDetail?.run_state?.running ? 'running' : 'idle'}
                </div>
                <button
                  className="btn btn-primary"
                  disabled={!selectedBattle || startMutation.isPending || Boolean(battleDetail?.run_state?.running)}
                  onClick={() => startMutation.mutate(selectedBattle)}
                >
                  <Play className="w-4 h-4" />
                  Run Battle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
              <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
                <div className="text-sm text-dark-400">Candidates</div>
                <div className="text-2xl font-bold text-white mt-1">{battleDetail?.candidates?.length ?? 0}</div>
              </div>
              <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
                <div className="text-sm text-dark-400">Generated</div>
                <div className="text-2xl font-bold text-white mt-1">{battleDetail?.candidates?.filter((item) => item.result?.article_path).length ?? 0}</div>
              </div>
              <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
                <div className="text-sm text-dark-400">Evaluated</div>
                <div className="text-2xl font-bold text-white mt-1">{battleDetail?.evaluation_summary?.count ?? 0}</div>
              </div>
              <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
                <div className="text-sm text-dark-400">Winner</div>
                <div className="text-sm font-semibold text-white mt-2">{winnerName ?? '—'}</div>
              </div>
            </div>

            {battleDetail?.evaluation_summary?.ranking?.length ? (
              <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4 mb-5">
                <div className="text-sm font-medium text-white mb-3">Leaderboard</div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {battleDetail.evaluation_summary.ranking.map((item) => (
                    <div key={item.candidate_name} className="rounded-lg border border-dark-800 bg-dark-950 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-white">{item.candidate_name}</div>
                        {item.is_winner ? <Award className="w-4 h-4 text-amber-400" /> : null}
                      </div>
                      <div className="text-xs text-dark-500 mt-2">
                        Score: {item.overall_score ?? '—'} • {item.verdict ?? 'no verdict'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {battleDetail?.candidates?.map((candidate) => (
                <button
                  key={candidate.name}
                  className={`rounded-xl border p-4 text-left transition-colors ${selectedCandidate === candidate.name ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                  onClick={() => setSelectedCandidate(candidate.name)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-white">{candidate.name}</div>
                    {candidate.evaluation?.is_winner ? <Award className="w-4 h-4 text-amber-400" /> : null}
                  </div>
                  <div className="text-xs text-dark-500 mt-2">
                    {candidate.result?.chars ?? 0} chars • {candidate.result?.words ?? 0} words
                  </div>
                  <div className="text-xs text-dark-500 mt-1">
                    {candidate.result?.h2 ?? 0} H2 • {candidate.result?.h3 ?? 0} H3 • {candidate.result?.seconds ?? 0}s
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {candidate.evaluation?.verdict ? <span className="badge badge-info">{candidate.evaluation.verdict}</span> : null}
                    {candidate.evaluation?.overall_score != null ? <span className="badge badge-info">score {candidate.evaluation.overall_score}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[0.85fr_0.95fr_420px] gap-6">
            <div className="space-y-6">
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <FileCode2 className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">User Prompt</h2>
                </div>
                <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[260px]">{userPromptPreview?.text ?? 'Select a candidate.'}</pre>
              </div>

              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Layers3 className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-semibold text-white">System Prompt</h2>
                </div>
                <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[220px]">{systemPromptPreview?.text ?? 'No system prompt for this candidate.'}</pre>
              </div>

              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <TerminalSquare className="w-5 h-5 text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">Battle Log</h2>
                </div>
                <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[220px]">{battleDetail?.log ?? 'No log yet.'}</pre>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">Generated Article</h2>
                </div>
                {activeCandidate?.result?.article_path ? (
                  <div className="flex gap-2">
                    <Link
                      className="btn btn-secondary"
                      to={`/workspace?run=${encodeURIComponent(`battle-${selectedBattle}`)}&article=${encodeURIComponent(activeCandidate.result.article_path)}`}
                    >
                      Open in Workspace
                    </Link>
                    <Link
                      className="btn btn-secondary"
                      to={`/experiments?project=${encodeURIComponent('crystal.tax')}&platform=${encodeURIComponent('devto')}&content_title=${encodeURIComponent(activeCandidate.name)}&source_artifact_path=${encodeURIComponent(activeCandidate.result.article_path)}`}
                    >
                      Create Experiment
                    </Link>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        promoteMutation.mutate({
                          asset_key: activePromptAssetKey,
                          project: 'crystal.tax',
                          label: activeCandidate.name,
                          status: 'promoted',
                          tier: 'experimental',
                          tags_csv: 'battle,promoted',
                          notes: `Promoted from battle ${selectedBattle}`,
                          default_for_project: true,
                          linked_test_case_slug: selectedBattle,
                        })
                      }
                    >
                      Promote Default
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        activateMutation.mutate({
                          asset_key: activePromptAssetKey,
                          target_prompt_name: 'seo_article_system.txt',
                        })
                      }
                    >
                      Apply Live
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="text-xs text-dark-500 mb-3 break-all">{activeCandidate?.result?.article_path ?? '—'}</div>
              {activePromptProfile ? (
                <div className="text-xs text-emerald-300 mb-3">
                  Prompt profile: {activePromptProfile.status} {activePromptProfile.default_for_project ? '• default for project' : ''}
                </div>
              ) : null}
              <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[720px]">{articlePreview?.text ?? 'No article selected.'}</pre>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">Evaluation</h2>
              </div>
              <div className="space-y-4">
                {scoreFields.map((field) => (
                  <div key={String(field)}>
                    <label className="label">{scoreLabels[String(field)]}</label>
                    <select
                      className="select"
                      value={(draftEvaluation[field] as number | null | undefined) ?? ''}
                      onChange={(e) => setDraftEvaluation((prev) => ({ ...prev, [field]: e.target.value ? Number(e.target.value) : null }))}
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
                    value={draftEvaluation.verdict ?? 'draft'}
                    onChange={(e) => setDraftEvaluation((prev) => ({ ...prev, verdict: e.target.value }))}
                  >
                    <option value="draft">draft</option>
                    <option value="weak">weak</option>
                    <option value="interesting">interesting</option>
                    <option value="strong">strong</option>
                    <option value="winner">winner</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 text-sm text-dark-200">
                  <input
                    type="checkbox"
                    checked={Boolean(draftEvaluation.is_winner)}
                    onChange={(e) => setDraftEvaluation((prev) => ({ ...prev, is_winner: e.target.checked }))}
                  />
                  Mark as winner
                </label>

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="textarea min-h-[220px]"
                    value={draftEvaluation.notes ?? ''}
                    onChange={(e) => setDraftEvaluation((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Why this prompt is better or worse. What signal should influence future prompt design?"
                  />
                </div>

                <button
                  className="btn btn-primary w-full"
                  disabled={!draftEvaluation.candidate_name || evaluationMutation.isPending}
                  onClick={() => evaluationMutation.mutate(draftEvaluation)}
                >
                  <Save className="w-4 h-4" />
                  Save Evaluation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_0.9fr] gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white">Prompt Library</h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
            <div className="space-y-3 max-h-[520px] overflow-auto pr-2">
              {registryItems.map((item) => (
                <button
                  key={item.key}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedRegistryPath === item.path ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                  onClick={() => setSelectedRegistryPath(item.path)}
                >
                  <div className="text-sm font-medium text-white">{item.label}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.kind} • {item.prompt_role ?? item.group}</div>
                  {item.topic ? <div className="text-xs text-dark-500 mt-1">{item.topic}</div> : null}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-dark-800 bg-dark-950/50 p-4">
              <div className="text-sm font-medium text-white mb-3">Prompt Asset Preview</div>
              <div className="text-xs text-dark-500 mb-3 break-all">{selectedRegistryPath || 'Select a prompt asset.'}</div>
              <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[440px]">
                {registryPreview?.text ?? 'No prompt selected.'}
              </pre>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Reusable Test Cases</h2>
          </div>
          <div className="space-y-4">
            {(testCases?.items ?? []).map((item) => (
              <button
                key={item.slug}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedBattle === item.slug ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                onClick={() => {
                  setSelectedBattle(item.slug)
                  setSelectedCandidate('')
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-white">{item.topic}</div>
                    <div className="text-xs text-dark-500 mt-1">{item.model} • {item.language}</div>
                  </div>
                  <span className="badge badge-info">{item.result_count}/{item.candidate_count}</span>
                </div>
                {item.top_outputs?.length ? (
                  <div className="grid grid-cols-1 gap-2 mt-4">
                    {item.top_outputs.map((output) => (
                      <div key={output.name} className="rounded-lg border border-dark-800 bg-dark-950 p-3">
                        <div className="text-xs font-medium text-white">{output.name}</div>
                        <div className="text-[11px] text-dark-500 mt-1">
                          {output.chars} chars • {output.words} words • {output.seconds}s
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-dark-500 mt-3">No completed outputs yet.</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
