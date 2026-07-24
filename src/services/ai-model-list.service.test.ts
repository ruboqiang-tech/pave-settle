import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchGeminiModels, fetchOpenAiModels, fetchAvailableModels } from './ai-model-list.service'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ai-model-list.service', () => {
  describe('fetchGeminiModels', () => {
    it('parses Gemini model list and filters by generateContent', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            description: 'Fast model',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/embedding-001',
            displayName: 'Embedding 001',
            supportedGenerationMethods: ['embedContent'],
          },
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }))

      const models = await fetchGeminiModels('test-key')

      expect(models).toHaveLength(2)
      expect(models[0].id).toBe('gemini-2.5-flash')
      expect(models[0].name).toBe('Gemini 2.5 Flash')
      expect(models[1].id).toBe('gemini-2.5-pro')
    })

    it('throws on empty API key', async () => {
      await expect(fetchGeminiModels('')).rejects.toThrow('请先填写 API Key')
    })

    it('throws on invalid API key (403)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }))

      await expect(fetchGeminiModels('bad-key')).rejects.toThrow('API Key 无效或权限不足')
    })

    it('returns empty array when no models match', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
        ] }),
      }))

      const models = await fetchGeminiModels('test-key')
      expect(models).toHaveLength(0)
    })

    it('returns empty array on missing models field', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }))

      const models = await fetchGeminiModels('test-key')
      expect(models).toHaveLength(0)
    })
  })

  describe('fetchOpenAiModels', () => {
    it('parses OpenAI model list from data array', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-4o', object: 'model' },
          { id: 'gpt-4o-mini', object: 'model' },
        ],
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }))

      const models = await fetchOpenAiModels('test-key', 'https://api.openai.com/v1')

      expect(models).toHaveLength(2)
      expect(models[0].id).toBe('gpt-4o')
      expect(models[1].id).toBe('gpt-4o-mini')
    })

    it('strips trailing slashes from baseUrl', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'model-1' }] }),
      }))

      await fetchOpenAiModels('key', 'https://relay.example.com/v1/')

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://relay.example.com/v1/models',
        expect.any(Object),
      )
    })

    it('throws on invalid API key (401)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }))

      await expect(fetchOpenAiModels('bad', 'https://api.openai.com/v1')).rejects.toThrow('API Key 无效')
    })

    it('handles relay APIs that return flat arrays', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 'claude-3-haiku' }]),
      }))

      const models = await fetchOpenAiModels('key', 'https://relay.example.com/v1')
      expect(models).toHaveLength(1)
      expect(models[0].id).toBe('claude-3-haiku')
    })
  })

  describe('fetchAvailableModels', () => {
    it('returns success with models for gemini', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [
          { name: 'models/gemini-2.5-flash', displayName: 'Flash', supportedGenerationMethods: ['generateContent'] },
        ] }),
      }))

      const result = await fetchAvailableModels('gemini', 'key')
      expect(result.status).toBe('success')
      expect(result.models).toHaveLength(1)
      expect(result.error).toBeUndefined()
    })

    it('returns success with warning when no models found', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      }))

      const result = await fetchAvailableModels('gemini', 'key')
      expect(result.status).toBe('success')
      expect(result.models).toHaveLength(0)
      expect(result.error).toContain('未找到可用模型')
    })

    it('returns error on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      const result = await fetchAvailableModels('openai', 'key', 'https://x.com/v1')
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })
  })
})
