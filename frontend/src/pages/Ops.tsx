import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, FileText, Play, Rocket, Save, ScrollText, Settings2, Sparkles, Square, TerminalSquare } from 'lucide-react'
import {
  activatePromptLabAsset,
  getOpsCatalog,
  getOpsFile,
  getOpsLogs,
  getOpsOutputs,
  getOpsPrompt,
  getOpsQueue,
  getOpsStatus,
  getPromptLabDefaults,
  launchOpsRun,
  runOpsAction,
  saveOpsPrompt,
  updateOpsRuntime,
  type OpsCatalogFile,
} from '../api'

function formatDuration(seconds?: number | null) {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

function formatDate(ts?: number) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

function inferOutputRoot(queuePath: string) {
  const basename = queuePath.split('/').pop()?.replace(/\.jsonl$/, '') ?? 'run'
  return `/data/QWEN/output_runs/${basename}`
}

export default function Ops() {
  const queryClient = useQueryClient()
  const [runtimeForm, setRuntimeForm] = useState({
    model: '',
    queue_path: '',
    output_root: '',
    limit: '50',
    offset: '0',
  })
  const [selectedPromptName, setSelectedPromptName] = useState('seo_article_system.txt')
  const [promptText, setPromptText] = useState('')
  const [selectedOutput, setSelectedOutput] = useState<string>('')
  const [selectedLog, setSelectedLog] = useState('nightly-service.log')

  const { data: status } = useQuery({
    queryKey: ['ops-status'],
    queryFn: getOpsStatus,
    refetchInterval: 5000,
  })

  const { data: catalog } = useQuery({
    queryKey: ['ops-catalog'],
    queryFn: getOpsCatalog,
    refetchInterval: 15000,
  })

  const { data: prompt } = useQuery({
    queryKey: ['ops-prompt', selectedPromptName],
    queryFn: () => getOpsPrompt(selectedPromptName),
  })

  const { data: promptDefaults } = useQuery({
    queryKey: ['promptlab-defaults'],
    queryFn: getPromptLabDefaults,
  })

  const { data: queue } = useQuery({
    queryKey: ['ops-queue', runtimeForm.queue_path],
    queryFn: () => getOpsQueue(40),
    refetchInterval: 8000,
  })

  const { data: outputs } = useQuery({
    queryKey: ['ops-outputs', status?.runtime?.output_root],
    queryFn: () => getOpsOutputs(40, status?.runtime?.output_root),
    refetchInterval: 8000,
  })

  const { data: logs } = useQuery({
    queryKey: ['ops-logs', selectedLog],
    queryFn: () => getOpsLogs(selectedLog, 30000),
    refetchInterval: 5000,
  })

  const { data: outputPreview } = useQuery({
    queryKey: ['ops-file', selectedOutput],
    queryFn: () => getOpsFile(selectedOutput),
    enabled: Boolean(selectedOutput),
  })

  useEffect(() => {
    if (status?.runtime) {
      setRuntimeForm({
        model: status.runtime.model ?? '',
        queue_path: status.runtime.queue_path ?? '',
        output_root: status.runtime.output_root ?? '',
        limit: String(status.runtime.limit ?? 50),
        offset: String(status.runtime.offset ?? 0),
      })
    }
  }, [status?.runtime])

  useEffect(() => {
    if (prompt?.text != null) {
      setPromptText(prompt.text)
    }
  }, [prompt?.text])

  useEffect(() => {
    if (!selectedOutput && outputs?.items?.length) {
      setSelectedOutput(outputs.items[0].path)
    }
  }, [outputs?.items, selectedOutput])

  const completionRatio = useMemo(() => {
    if (!status?.total_items) return 0
    return Math.min(100, Math.round(((status.completed_items ?? 0) / status.total_items) * 100))
  }, [status?.completed_items, status?.total_items])

  const quickQueues = useMemo(() => (catalog?.queues ?? []).slice(0, 6), [catalog?.queues])
  const quickPrompts = useMemo(() => (catalog?.prompts ?? []).slice(0, 6), [catalog?.prompts])

  const actionMutation = useMutation({
    mutationFn: runOpsAction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-status'] })
      await queryClient.invalidateQueries({ queryKey: ['ops-logs'] })
    },
  })

  const runtimeMutation = useMutation({
    mutationFn: updateOpsRuntime,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-status'] })
    },
  })

  const promptMutation = useMutation({
    mutationFn: saveOpsPrompt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-prompt', selectedPromptName] })
      await queryClient.invalidateQueries({ queryKey: ['ops-catalog'] })
    },
  })

  const launchMutation = useMutation({
    mutationFn: launchOpsRun,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-status'] })
      await queryClient.invalidateQueries({ queryKey: ['ops-logs'] })
    },
  })

  const activatePromptMutation = useMutation({
    mutationFn: activatePromptLabAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ops-prompt', selectedPromptName] })
      await queryClient.invalidateQueries({ queryKey: ['promptlab-defaults'] })
    },
  })

  function applyQueuePreset(item: OpsCatalogFile) {
    setRuntimeForm((prev) => ({
      ...prev,
      queue_path: item.path,
      output_root: prev.output_root || inferOutputRoot(item.path),
    }))
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Ops</h1>
          <p className="text-dark-400 mt-1">Launcher, runtime control, prompt editing, queues, outputs, and service logs.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => actionMutation.mutate('start_ollama')}>
            <Play className="w-4 h-4" />
            Ollama
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              launchMutation.mutate({
                model: runtimeForm.model,
                queue_path: runtimeForm.queue_path,
                output_root: runtimeForm.output_root,
                limit: Number(runtimeForm.limit),
                offset: Number(runtimeForm.offset),
                stop_existing: true,
              })
            }
          >
            <Rocket className="w-4 h-4" />
            Launch Run
          </button>
          <button className="btn btn-secondary" onClick={() => actionMutation.mutate('stop_run')}>
            <Square className="w-4 h-4" />
            Stop
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Runner</p>
              <p className="text-2xl font-bold text-white mt-1 capitalize">{status?.runner_state ?? 'unknown'}</p>
            </div>
            <Activity className="w-6 h-6 text-primary-400" />
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Model</p>
          <p className="text-lg font-semibold text-white mt-1">{status?.runtime?.model ?? '—'}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Progress</p>
          <p className="text-2xl font-bold text-white mt-1">{status?.completed_items ?? 0}/{status?.total_items ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dark-400">Last Item</p>
          <p className="text-lg font-semibold text-white mt-1">{formatDuration(status?.last_item_seconds)}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Run Status</h2>
          <span className="badge badge-info">{completionRatio}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-dark-800 overflow-hidden mb-4">
          <div className="h-full bg-gradient-to-r from-primary-500 to-emerald-500" style={{ width: `${completionRatio}%` }} />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div><span className="text-dark-500">Queue:</span> <span className="text-dark-200">{status?.runtime?.queue_path ?? '—'}</span></div>
            <div><span className="text-dark-500">Output:</span> <span className="text-dark-200">{status?.runtime?.output_root ?? '—'}</span></div>
            <div><span className="text-dark-500">Started:</span> <span className="text-dark-200">{status?.started_at ?? '—'}</span></div>
            <div><span className="text-dark-500">Finished:</span> <span className="text-dark-200">{status?.finished_at ?? '—'}</span></div>
          </div>
          <div className="space-y-2">
            <div><span className="text-dark-500">Current:</span> <span className="text-dark-200">{String(status?.current_item?.title ?? '—')}</span></div>
            <div><span className="text-dark-500">Last output:</span> <span className="text-dark-200 break-all">{status?.last_output ?? '—'}</span></div>
            <div><span className="text-dark-500">Run time:</span> <span className="text-dark-200">{formatDuration(status?.total_seconds)}</span></div>
            <div><span className="text-dark-500">Index:</span> <span className="text-dark-200">{status?.current_index ?? '—'}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="card space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white">Run Launcher</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <label className="label">Model</label>
              <select className="select" value={runtimeForm.model} onChange={(e) => setRuntimeForm((prev) => ({ ...prev, model: e.target.value }))}>
                <option value="">Select model</option>
                {(catalog?.models ?? []).map((item) => (
                  <option key={item.name} value={item.name}>{item.name} • {item.size}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Prompt File</label>
              <select className="select" value={selectedPromptName} onChange={(e) => setSelectedPromptName(e.target.value)}>
                {quickPrompts.map((item) => (
                  <option key={item.path} value={item.name}>{item.relative_path}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <label className="label m-0">Project Defaults</label>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {(promptDefaults?.items ?? []).map((item) => (
                <button
                  key={item.profile.asset_key}
                  className="rounded-lg border border-dark-800 bg-dark-950/50 p-3 text-left hover:bg-dark-800"
                  onClick={() =>
                    activatePromptMutation.mutate({
                      asset_key: item.profile.asset_key,
                      target_prompt_name: selectedPromptName,
                    })
                  }
                >
                  <div className="text-sm font-medium text-white">{item.profile.project || 'project'}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.profile.label || item.asset.label}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.profile.status} • {item.profile.tier || 'no tier'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <label className="label">Queue Path</label>
              <input className="input" value={runtimeForm.queue_path} onChange={(e) => setRuntimeForm((prev) => ({ ...prev, queue_path: e.target.value }))} />
            </div>
            <div>
              <label className="label">Output Root</label>
              <input className="input" value={runtimeForm.output_root} onChange={(e) => setRuntimeForm((prev) => ({ ...prev, output_root: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Limit</label>
              <input className="input" value={runtimeForm.limit} onChange={(e) => setRuntimeForm((prev) => ({ ...prev, limit: e.target.value }))} />
            </div>
            <div>
              <label className="label">Offset</label>
              <input className="input" value={runtimeForm.offset} onChange={(e) => setRuntimeForm((prev) => ({ ...prev, offset: e.target.value }))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label">Quick Queues</label>
              <span className="text-xs text-dark-500">{catalog?.queues?.length ?? 0} found</span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {quickQueues.map((item) => (
                <button key={item.path} className="rounded-lg border border-dark-800 bg-dark-950/50 p-3 text-left hover:bg-dark-800" onClick={() => applyQueuePreset(item)}>
                  <div className="text-sm font-medium text-white">{item.name}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.relative_path}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label">Recent Output Roots</label>
              <span className="text-xs text-dark-500">{catalog?.output_roots?.length ?? 0} known</span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {(catalog?.output_roots ?? []).slice(0, 6).map((item) => (
                <button
                  key={item.path}
                  className="rounded-lg border border-dark-800 bg-dark-950/50 p-3 text-left hover:bg-dark-800"
                  onClick={() => setRuntimeForm((prev) => ({ ...prev, output_root: item.path }))}
                >
                  <div className="text-sm font-medium text-white">{item.name}</div>
                  <div className="text-xs text-dark-500 mt-1">{item.article_count} articles</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <button
              className="btn btn-primary w-full"
              onClick={() =>
                launchMutation.mutate({
                  model: runtimeForm.model,
                  queue_path: runtimeForm.queue_path,
                  output_root: runtimeForm.output_root,
                  limit: Number(runtimeForm.limit),
                  offset: Number(runtimeForm.offset),
                  stop_existing: true,
                })
              }
            >
              <Rocket className="w-4 h-4" />
              Save + Launch
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={() =>
                runtimeMutation.mutate({
                  model: runtimeForm.model,
                  queue_path: runtimeForm.queue_path,
                  output_root: runtimeForm.output_root,
                  limit: Number(runtimeForm.limit),
                  offset: Number(runtimeForm.offset),
                })
              }
            >
              <Save className="w-4 h-4" />
              Save Runtime
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ScrollText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Prompt Editor</h2>
          </div>
          <div className="text-xs text-dark-500 mb-3">{prompt?.path ?? '—'}</div>
          <textarea className="textarea min-h-[540px] font-mono text-xs" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
          <button className="btn btn-secondary mt-4 w-full" onClick={() => promptMutation.mutate({ name: selectedPromptName, text: promptText })}>
            <Save className="w-4 h-4" />
            Save Prompt
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Queue Snapshot</h2>
            <span className="text-xs text-dark-500">{queue?.items?.length ?? 0} shown</span>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-auto pr-2">
            {queue?.items?.map((item, index) => (
              <div key={`${item.id}-${index}`} className="rounded-lg border border-dark-800 bg-dark-950/50 p-4">
                <div className="text-xs text-dark-500 mb-1">{String(item.project ?? '—')} • #{String(item.id ?? '—')}</div>
                <div className="font-medium text-white">{String(item.title ?? '—')}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Outputs</h2>
            <span className="text-xs text-dark-500">{outputs?.items?.length ?? 0} files</span>
          </div>
          <div className="grid grid-cols-1 2xl:grid-cols-[0.9fr_1.1fr] gap-4">
            <div className="space-y-2 max-h-[520px] overflow-auto pr-2">
              {outputs?.items?.map((item) => (
                <button
                  key={item.path}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedOutput === item.path ? 'border-primary-500 bg-primary-500/10' : 'border-dark-800 bg-dark-950/50 hover:bg-dark-800'}`}
                  onClick={() => setSelectedOutput(item.path)}
                >
                  <div className="text-xs text-dark-500">{item.project}</div>
                  <div className="text-sm font-medium text-white break-all">{item.name}</div>
                  <div className="text-xs text-dark-500 mt-1">{formatDate(item.updated_at)} • {Math.round(item.size / 1024)} KB</div>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-dark-800 bg-dark-950 p-4">
              <div className="flex items-center gap-2 text-dark-300 mb-3">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">{selectedOutput || 'Select a file'}</span>
              </div>
              <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[460px]">{outputPreview?.text ?? 'No file selected.'}</pre>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TerminalSquare className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Logs</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['nightly-service.log', 'ollama.log', 'web.log', 'control.log'].map((name) => (
              <button
                key={name}
                className={`btn ${selectedLog === name ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedLog(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <pre className="text-xs text-dark-200 whitespace-pre-wrap overflow-auto max-h-[420px]">{logs?.text ?? 'No logs loaded.'}</pre>
      </div>
    </div>
  )
}
