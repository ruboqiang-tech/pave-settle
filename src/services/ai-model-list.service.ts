/**
 * AI 模型列表获取服务。
 * 通过调用 Gemini / OpenAI 兼容 API 的 models 端点，
 * 获取当前 API Key 可用的模型列表供用户在下拉框中选择。
 */

export interface AiModelInfo {
  /** 模型标识符，如 'gemini-2.5-flash'、'gpt-4o-mini' */
  id: string
  /** 用于显示的名称 */
  name: string
  /** 可选描述 */
  description?: string
}

export type FetchModelsStatus = 'idle' | 'loading' | 'success' | 'error'

export interface FetchModelsResult {
  status: 'success' | 'error'
  models: AiModelInfo[]
  error?: string
}

const FETCH_TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('请求超时，请检查网络或代理设置')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 从 Google Gemini API 获取可用的生成式模型列表。
 * 只返回支持 generateContent 方法的模型。
 */
export async function fetchGeminiModels(apiKey: string): Promise<AiModelInfo[]> {
  if (!apiKey.trim()) throw new Error('请先填写 API Key')

  const isLocal = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  const baseUrl = isLocal ? '/gemini-api' : 'https://generativelanguage.googleapis.com'
  const url = `${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    if (response.status === 400 || response.status === 403) {
      throw new Error('API Key 无效或权限不足，请核实后重试')
    }
    throw new Error(`Gemini API 请求失败 (${response.status})`)
  }

  const data = await response.json()
  const models: AiModelInfo[] = []

  if (!Array.isArray(data?.models)) return models

  for (const model of data.models) {
    const methods: string[] = model.supportedGenerationMethods ?? []
    if (!methods.includes('generateContent')) continue

    const rawName: string = model.name ?? ''
    const id = rawName.startsWith('models/') ? rawName.slice(7) : rawName
    if (!id) continue

    models.push({
      id,
      name: (model.displayName as string) || id,
      description: model.description as string | undefined,
    })
  }

  models.sort((a, b) => a.id.localeCompare(b.id))
  return models
}

/**
 * 从 OpenAI 兼容 API 获取可用的模型列表。
 * 适配标准 OpenAI 及各类中转站的 /v1/models 端点。
 */
export async function fetchOpenAiModels(apiKey: string, baseUrl: string): Promise<AiModelInfo[]> {
  if (!apiKey.trim()) throw new Error('请先填写 API Key')

  const cleanUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const url = `${cleanUrl}/models`

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('API Key 无效，请核实后重试')
    }
    if (response.status === 403) {
      throw new Error('API Key 权限不足，请核实后重试')
    }
    throw new Error(`OpenAI API 请求失败 (${response.status})`)
  }

  const data = await response.json()
  const rawModels: unknown[] = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])

  const models: AiModelInfo[] = []

  for (const item of rawModels) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const id = String(record.id ?? '')
    if (!id) continue

    models.push({
      id,
      name: id,
      description: typeof record.description === 'string' ? record.description : undefined,
    })
  }

  models.sort((a, b) => a.id.localeCompare(b.id))
  return models
}

/**
 * 统一入口：根据 provider 类型获取模型列表。
 */
export async function fetchAvailableModels(
  provider: 'gemini' | 'openai',
  apiKey: string,
  baseUrl?: string,
): Promise<FetchModelsResult> {
  try {
    const models = provider === 'gemini'
      ? await fetchGeminiModels(apiKey)
      : await fetchOpenAiModels(apiKey, baseUrl || 'https://api.openai.com/v1')

    if (models.length === 0) {
      return { status: 'success', models, error: '未找到可用模型，请确认 API Key 的权限' }
    }

    return { status: 'success', models }
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取模型列表失败'
    return { status: 'error', models: [], error: message }
  }
}
