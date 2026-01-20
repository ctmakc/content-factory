import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Settings as SettingsIcon,
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
  Bot,
  AlertCircle,
} from 'lucide-react'
import {
  getApiKeys,
  createApiKey,
  deleteApiKey,
  setDefaultApiKey,
  getSocialAccounts,
  createSocialAccount,
  deleteSocialAccount,
  ApiKey,
  SocialAccount,
} from '../api'

const providerIcons: Record<string, React.ElementType> = {
  openai: Bot,
  anthropic: Bot,
}

const platformIcons: Record<string, React.ElementType> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'ai' | 'social'>('ai')
  const [showAddKey, setShowAddKey] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newKey, setNewKey] = useState({ provider: 'openai', name: '', key: '' })
  const [newAccount, setNewAccount] = useState({ platform: 'linkedin', username: '', display_name: '' })
  const queryClient = useQueryClient()

  // API Keys queries
  const { data: apiKeys = [], isLoading: keysLoading, error: keysError } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: getApiKeys,
  })

  const createKeyMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      setNewKey({ provider: 'openai', name: '', key: '' })
      setShowAddKey(false)
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })

  // Social Accounts queries
  const { data: socialAccounts = [], isLoading: accountsLoading, error: accountsError } = useQuery({
    queryKey: ['socialAccounts'],
    queryFn: getSocialAccounts,
  })

  const createAccountMutation = useMutation({
    mutationFn: createSocialAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialAccounts'] })
      setNewAccount({ platform: 'linkedin', username: '', display_name: '' })
      setShowAddAccount(false)
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: deleteSocialAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialAccounts'] })
    },
  })

  const handleAddKey = () => {
    if (!newKey.name || !newKey.key) return
    createKeyMutation.mutate({
      provider: newKey.provider,
      name: newKey.name,
      api_key: newKey.key,
    })
  }

  const handleAddAccount = () => {
    if (!newAccount.username) return
    createAccountMutation.mutate({
      platform: newAccount.platform,
      username: newAccount.username,
      display_name: newAccount.display_name || undefined,
    })
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-dark-400 mt-1">Manage your API keys and connected accounts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-800 pb-4">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'ai'
              ? 'bg-primary-600/20 text-primary-400'
              : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
          }`}
        >
          <Key className="w-4 h-4" />
          AI Providers
        </button>
        <button
          onClick={() => setActiveTab('social')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'social'
              ? 'bg-primary-600/20 text-primary-400'
              : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
          }`}
        >
          <Linkedin className="w-4 h-4" />
          Social Accounts
        </button>
      </div>

      {/* AI Providers Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* Add New Key Button */}
          {!showAddKey && (
            <button
              onClick={() => setShowAddKey(true)}
              className="btn btn-secondary"
            >
              <Plus className="w-4 h-4" />
              Add API Key
            </button>
          )}

          {/* Add Key Form */}
          {showAddKey && (
            <div className="card border-primary-500/30">
              <h3 className="font-medium text-white mb-4">Add New API Key</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Provider</label>
                  <select
                    className="select"
                    value={newKey.provider}
                    onChange={(e) => setNewKey(prev => ({ ...prev, provider: e.target.value }))}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    placeholder="e.g., Production, Development"
                    value={newKey.name}
                    onChange={(e) => setNewKey(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">API Key</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="sk-..."
                    value={newKey.key}
                    onChange={(e) => setNewKey(prev => ({ ...prev, key: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddKey}
                    className="btn btn-primary"
                    disabled={createKeyMutation.isPending}
                  >
                    {createKeyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Key
                  </button>
                  <button onClick={() => setShowAddKey(false)} className="btn btn-ghost">
                    Cancel
                  </button>
                </div>
                {createKeyMutation.isError && (
                  <p className="text-red-400 text-sm">{createKeyMutation.error.message}</p>
                )}
              </div>
            </div>
          )}

          {/* API Keys List */}
          <div className="space-y-3">
            {keysLoading ? (
              <div className="card flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
              </div>
            ) : keysError ? (
              <div className="card bg-red-500/10 border-red-500/20">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">Failed to load API keys</span>
                </div>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="card text-center py-12">
                <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-dark-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No API Keys</h3>
                <p className="text-dark-400 mb-4">Add an API key to start generating content with AI.</p>
              </div>
            ) : (
              apiKeys.map((apiKey) => {
                const Icon = providerIcons[apiKey.provider] || Key
                return (
                  <div key={apiKey.id} className="card hover:border-dark-700 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-dark-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{apiKey.name}</h3>
                            {apiKey.is_default && (
                              <span className="badge badge-success text-xs">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-dark-400 capitalize">{apiKey.provider}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <code className="text-sm text-dark-400 bg-dark-800 px-3 py-1 rounded font-mono">
                          {apiKey.api_key_masked}
                        </code>
                        {!apiKey.is_default && (
                          <button
                            onClick={() => setDefaultMutation.mutate(apiKey.id)}
                            className="btn btn-ghost text-xs"
                            disabled={setDefaultMutation.isPending}
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => deleteKeyMutation.mutate(apiKey.id)}
                          className="btn btn-ghost p-2 text-red-400 hover:text-red-300"
                          disabled={deleteKeyMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Social Accounts Tab */}
      {activeTab === 'social' && (
        <div className="space-y-6">
          {!showAddAccount && (
            <button onClick={() => setShowAddAccount(true)} className="btn btn-secondary">
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          )}

          {showAddAccount && (
            <div className="card border-primary-500/30">
              <h3 className="font-medium text-white mb-4">Add Social Account</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Platform</label>
                  <select
                    className="select"
                    value={newAccount.platform}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, platform: e.target.value }))}
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">Twitter</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>
                <div>
                  <label className="label">Username</label>
                  <input
                    className="input"
                    placeholder="@username"
                    value={newAccount.username}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Display Name (optional)</label>
                  <input
                    className="input"
                    placeholder="Crystal Tax"
                    value={newAccount.display_name}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, display_name: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddAccount}
                    className="btn btn-primary"
                    disabled={createAccountMutation.isPending}
                  >
                    {createAccountMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Account
                  </button>
                  <button onClick={() => setShowAddAccount(false)} className="btn btn-ghost">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {accountsLoading ? (
              <div className="card flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
              </div>
            ) : accountsError ? (
              <div className="card bg-red-500/10 border-red-500/20">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">Failed to load accounts</span>
                </div>
              </div>
            ) : socialAccounts.length === 0 ? (
              <div className="card text-center py-12">
                <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
                  <Linkedin className="w-8 h-8 text-dark-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Connected Accounts</h3>
                <p className="text-dark-400 mb-4">Add your social media accounts to manage posting.</p>
              </div>
            ) : (
              socialAccounts.map((account) => {
                const Icon = platformIcons[account.platform] || Linkedin
                return (
                  <div key={account.id} className="card hover:border-dark-700 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-dark-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white capitalize">{account.platform}</h3>
                          <p className="text-sm text-dark-400">{account.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge ${account.is_connected ? 'badge-success' : 'badge-warning'}`}>
                          {account.is_connected ? 'Connected' : 'Manual'}
                        </span>
                        <button
                          onClick={() => deleteAccountMutation.mutate(account.id)}
                          className="btn btn-ghost p-2 text-red-400 hover:text-red-300"
                          disabled={deleteAccountMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* OAuth Notice */}
          <div className="card bg-amber-500/5 border-amber-500/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <SettingsIcon className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">OAuth Integration</h3>
                <p className="text-sm text-dark-400">
                  Full OAuth authentication for automated posting is coming soon.
                  For now, you can copy generated content and post manually.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
