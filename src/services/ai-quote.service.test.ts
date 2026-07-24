import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiQuoteService } from './ai-quote.service'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ai-quote.service', () => {
  describe('Gemini Provider', () => {
    it('successfully fetches and parses AI quote with search grounding', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    price: 450.50,
                    supplier: '云通建材报价网',
                    taxCaliber: '含税到场',
                    deliveryPoint: '昆明晋宁',
                    remark: '近期价格小幅波动，参考链接：https://example.com/price'
                  })
                }
              ]
            }
          }
        ]
      }

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await aiQuoteService.fetchAiQuote(
        { provider: 'gemini', apiKey: 'fake-api-key' },
        '路用木质素纤维',
        '木纤维 0.1-2.0mm',
        'material'
      )

      // Verify fetch parameters
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledUrl, calledInit] = fetchMock.mock.calls[0]
      expect(calledUrl).toContain('/gemini-api/v1beta/models/gemini-2.5-flash:generateContent?key=fake-api-key')
      expect(calledInit.method).toBe('POST')
      
      const body = JSON.parse(calledInit.body)
      expect(body.tools[0].googleSearchRetrieval).toBeDefined()
      expect(body.generationConfig.responseMimeType).toBe('application/json')
      expect(body.contents[0].parts[0].text).toContain('路用木质素纤维')

      // Verify parsed results
      expect(result.price).toBe(450.50)
      expect(result.supplier).toBe('云通建材报价网')
      expect(result.taxCaliber).toBe('含税到场')
      expect(result.deliveryPoint).toBe('昆明晋宁')
      expect(result.remark).toContain('https://example.com/price')
    })

    it('handles HTTP error status', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'API Key Invalid'
      })
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        aiQuoteService.fetchAiQuote({ provider: 'gemini', apiKey: 'bad-key' }, '砂石', '', 'material')
      ).rejects.toThrow('Google API 请求失败 (400): API Key Invalid')
    })

    it('handles invalid JSON format in model response', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'This is not valid JSON string'
                }
              ]
            }
          }
        ]
      }

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        aiQuoteService.fetchAiQuote({ provider: 'gemini', apiKey: 'fake-key' }, '砂石', '', 'material')
      ).rejects.toThrow('AI 返回的格式无法被成功解析为 JSON 对象，请重试！')
    })
  })

  describe('OpenAI Provider', () => {
    it('successfully fetches and parses OpenAI compatible quote', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                price: 180.00,
                supplier: '云南水泥集团',
                taxCaliber: '不含税到场',
                deliveryPoint: '安宁',
                remark: '目前出厂价格保持稳定，无大幅度涨落'
              })
            }
          }
        ]
      }

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await aiQuoteService.fetchAiQuote(
        {
          provider: 'openai',
          apiKey: 'fake-openai-key',
          baseUrl: 'https://api.my-relay.com/v1',
          model: 'gpt-4o-mini'
        },
        'P.O 42.5 水泥',
        '散装',
        'material'
      )

      // Verify fetch parameters
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledUrl, calledInit] = fetchMock.mock.calls[0]
      expect(calledUrl).toBe('https://api.my-relay.com/v1/chat/completions')
      expect(calledInit.method).toBe('POST')
      expect(calledInit.headers['Authorization']).toBe('Bearer fake-openai-key')
      
      const body = JSON.parse(calledInit.body)
      expect(body.model).toBe('gpt-4o-mini')
      expect(body.response_format.type).toBe('json_object')
      expect(body.messages[0].content).toContain('P.O 42.5 水泥')

      // Verify parsed results
      expect(result.price).toBe(180.00)
      expect(result.supplier).toBe('云南水泥集团')
      expect(result.taxCaliber).toBe('不含税到场')
      expect(result.deliveryPoint).toBe('安宁')
      expect(result.remark).toContain('价格保持稳定')
    })

    it('handles OpenAI HTTP error status', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        aiQuoteService.fetchAiQuote(
          {
            provider: 'openai',
            apiKey: 'bad-key',
            baseUrl: 'https://api.my-relay.com/v1'
          },
          '砂石',
          '',
          'material'
        )
      ).rejects.toThrow('OpenAI API 请求失败 (401): Unauthorized')
    })

    it('passes non-material category context into the quote prompt', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  price: 5600,
                  supplier: '本地行业信息价',
                  taxCaliber: '含税',
                  deliveryPoint: '云南省内',
                  remark: '机械租赁市场估价'
                })
              }
            }
          ]
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      await aiQuoteService.fetchAiQuote(
        {
          provider: 'openai',
          apiKey: 'fake-openai-key'
        },
        '摊铺机',
        '9m',
        'machine'
      )

      const [, calledInit] = fetchMock.mock.calls[0]
      const body = JSON.parse(calledInit.body)
      expect(body.messages[0].content).toContain('工程施工机械设备租赁费')
      expect(body.messages[0].content).toContain("机械为'元/台班'")
    })
  })
})
