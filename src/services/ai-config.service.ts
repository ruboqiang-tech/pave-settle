import {
  execToObjects,
  getDb,
  getRowNumber,
  getRowString,
  saveToStorage,
  withTransaction,
} from './db-core'

export type AiProvider = 'gemini' | 'openai'

export interface AiProviderConfig {
  id: string
  name: string
  provider: AiProvider
  apiKey: string
  baseUrl: string
  model: string
  enabled: boolean
  isDefault: boolean
}

export type AiProviderConfigInput = Omit<AiProviderConfig, 'id'>

const DEFAULT_CONFIGS: AiProviderConfig[] = [
  {
    id: 'ai-gemini-default',
    name: 'Gemini 默认 Key',
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    model: 'gemini-2.5-flash',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'ai-openai-relay-default',
    name: 'OpenAI 中转 Key',
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    enabled: true,
    isDefault: false,
  },
]

function readLegacyLocalConfigs(): AiProviderConfig[] {
  if (typeof localStorage === 'undefined') return []

  const legacyProvider = localStorage.getItem('settlement_ai_provider') as AiProvider | null
  const geminiApiKey = localStorage.getItem('settlement_gemini_api_key') || ''
  const openaiApiKey = localStorage.getItem('settlement_openai_api_key') || ''
  const openaiApiUrl = localStorage.getItem('settlement_openai_api_url') || 'https://api.openai.com/v1'
  const openaiModel = localStorage.getItem('settlement_openai_model') || 'gpt-4o-mini'

  return DEFAULT_CONFIGS.map(config => {
    if (config.provider === 'gemini') {
      return {
        ...config,
        apiKey: geminiApiKey,
        isDefault: legacyProvider ? legacyProvider === 'gemini' : config.isDefault,
      }
    }

    return {
      ...config,
      apiKey: openaiApiKey,
      baseUrl: openaiApiUrl,
      model: openaiModel,
      isDefault: legacyProvider === 'openai',
    }
  })
}

function assertDb() {
  const db = getDb()
  if (!db) throw new Error('Database not initialized')
  return db
}

function mapConfigRow(row: Record<string, unknown>): AiProviderConfig {
  return {
    id: getRowString(row, 'id'),
    name: getRowString(row, 'name'),
    provider: getRowString(row, 'provider', 'gemini') as AiProvider,
    apiKey: getRowString(row, 'api_key'),
    baseUrl: getRowString(row, 'base_url'),
    model: getRowString(row, 'model'),
    enabled: getRowNumber(row, 'enabled', 1) === 1,
    isDefault: getRowNumber(row, 'is_default', 0) === 1,
  }
}

function normalizeConfig(config: AiProviderConfig): AiProviderConfig {
  const fallback = config.provider === 'openai'
    ? DEFAULT_CONFIGS[1]
    : DEFAULT_CONFIGS[0]

  return {
    ...config,
    name: config.name.trim() || fallback.name,
    baseUrl: config.provider === 'openai'
      ? (config.baseUrl.trim() || 'https://api.openai.com/v1')
      : '',
    model: config.model.trim() || fallback.model,
  }
}

async function upsertConfig(config: AiProviderConfig): Promise<void> {
  const db = assertDb()
  const normalized = normalizeConfig(config)
  db.run(
    `INSERT OR REPLACE INTO ai_provider_configs
      (id, name, provider, api_key, base_url, model, enabled, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalized.id,
      normalized.name,
      normalized.provider,
      normalized.apiKey,
      normalized.baseUrl,
      normalized.model,
      normalized.enabled ? 1 : 0,
      normalized.isDefault ? 1 : 0,
    ],
  )
}

export const aiConfigService = {
  defaultConfigs(): AiProviderConfig[] {
    return DEFAULT_CONFIGS.map(item => ({ ...item }))
  },

  async seedIfEmpty(): Promise<void> {
    const db = getDb()
    if (!db) return

    const count = Number(db.exec('SELECT count(*) FROM ai_provider_configs')[0]?.values?.[0]?.[0] ?? 0)
    if (count > 0) return

    const seedConfigs = readLegacyLocalConfigs()
    await withTransaction(async () => {
      for (const config of (seedConfigs.length > 0 ? seedConfigs : DEFAULT_CONFIGS)) {
        await upsertConfig(config)
      }
    })
    await saveToStorage()
  },

  async list(): Promise<AiProviderConfig[]> {
    const db = getDb()
    if (!db) return []

    await this.seedIfEmpty()
    const rows = execToObjects(
      db.exec('SELECT * FROM ai_provider_configs ORDER BY is_default DESC, created_at, id'),
    )
    return rows.map(mapConfigRow)
  },

  async getDefaultRunnable(): Promise<AiProviderConfig | null> {
    const configs = await this.list()
    const runnable = configs.filter(config => config.enabled && config.apiKey.trim())
    return runnable.find(config => config.isDefault) ?? runnable[0] ?? null
  },

  async saveAll(configs: AiProviderConfig[]): Promise<AiProviderConfig[]> {
    const db = assertDb()
    const normalized = configs.map(config => normalizeConfig(config))
    const defaultIndex = normalized.findIndex(config => config.isDefault)
    const effectiveDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0

    await withTransaction(async () => {
      db.run('DELETE FROM ai_provider_configs')
      for (let index = 0; index < normalized.length; index += 1) {
        await upsertConfig({
          ...normalized[index],
          isDefault: index === effectiveDefaultIndex,
        })
      }
    })
    await saveToStorage()
    return this.list()
  },

  createConfig(provider: AiProvider = 'gemini'): AiProviderConfig {
    const fallback = provider === 'openai' ? DEFAULT_CONFIGS[1] : DEFAULT_CONFIGS[0]
    return {
      ...fallback,
      id: `ai-${provider}-${Date.now()}`,
      name: provider === 'openai' ? 'OpenAI 中转 Key' : 'Gemini Key',
      apiKey: '',
      isDefault: false,
    }
  },
}
