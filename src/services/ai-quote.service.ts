export interface AiQuoteResult {
  price: number
  supplier: string
  taxCaliber: string
  deliveryPoint: string
  remark: string
}

export interface AiQuoteConfig {
  provider: 'gemini' | 'openai'
  apiKey: string
  baseUrl?: string
  model?: string
}

function parseAiQuoteText(text: string, fallbackSupplier: string): AiQuoteResult {
  const trimmed = text.trim()
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0] || ''

  if (!jsonText) {
    throw new Error('AI 返回的格式无法被成功解析为 JSON 对象，请重试！')
  }

  const parsed = JSON.parse(jsonText) as AiQuoteResult
  return {
    price: Number(parsed.price || 0),
    supplier: String(parsed.supplier || fallbackSupplier),
    taxCaliber: String(parsed.taxCaliber || '含税到场'),
    deliveryPoint: String(parsed.deliveryPoint || '云南本地'),
    remark: String(parsed.remark || '无')
  }
}

export const aiQuoteService = {
  /**
   * 统一智能估价入口，根据提供商选择调用 Gemini 或 OpenAI 兼容接口。
   */
  async fetchAiQuote(
    config: AiQuoteConfig,
    name: string,
    spec: string,
    category: string
  ): Promise<AiQuoteResult> {
    if (config.provider === 'openai') {
      return this.fetchOpenAiQuote(
        config.baseUrl || 'https://api.openai.com/v1',
        config.apiKey,
        config.model || 'gpt-4o-mini',
        name,
        spec,
        category
      )
    } else {
      return this.fetchGeminiQuote(
        config.apiKey,
        config.model || 'gemini-2.5-flash',
        name,
        spec,
        category
      )
    }
  },

  /**
   * 调用 Google Gemini API (支持 Search Grounding)
   */
  async fetchGeminiQuote(
    apiKey: string,
    model: string,
    name: string,
    spec: string,
    category: string
  ): Promise<AiQuoteResult> {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const baseUrl = isLocal ? '/gemini-api' : 'https://generativelanguage.googleapis.com'
    const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`

    const categoryText = {
      material: '原材料/建筑材料',
      finished: '成品沥青混合料/水稳成品混合料',
      labor: '人工/劳务工种',
      transport: '成品混合料物流运输费',
      machine: '工程施工机械设备租赁费'
    }[category] || category

    const prompt = `请检索或估算最新关于"中国云南地区"的"${name}"（规格型号为"${spec || '不限'}"，分类为"${categoryText}"）的真实工程行业到场价、市场指导价或信息价。
如果人工工种、机械台班或专项服务缺少公开网页报价，请基于云南工程市场常见水平、施工成本口径和规格描述做保守估算，不要因为缺少公开网页而拒绝返回。
并在获取或估算后，选择最合理的一条记录，按以下标准 JSON 格式进行返回。
【注意】不要返回任何 markdown 标记（如 \`\`\`json \`\`\` 块），只需直接返回一个纯 JSON 字符串！

JSON 结构定义：
{
  "price": 0.00, // 检索出的单价数字（必须是数值类型，不要带单位如'元'，原材料和成品料通常为'元/t'，人工为'元/工日'，机械为'元/台班'，运输为'元/t·km'）
  "supplier": "这里填写查到的信息来源网站名称或参考供应商名称（不超过40字）",
  "taxCaliber": "税费口径说明，如'含税到场'或'不含税到场'，若查不到可用'含税'或'市场指导价'",
  "deliveryPoint": "报价适用点/到场区域，如'昆明晋宁'、'云南省内'等",
  "remark": "对价格情况或近几个月价格波动的简要说明，并在此处的段尾附上该条信息来源的完整网页 URL 链接！"
}`

    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      tools: [{
        googleSearchRetrieval: {} // 开启谷歌搜索联网插件
      }],
      generationConfig: {
        responseMimeType: 'application/json' // 强力约束返回为 JSON 格式
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google API 请求失败 (${response.status}): ${errText || '未知错误'}`)
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('未获取到有效的 AI 生成内容')
    }

    try {
      return parseAiQuoteText(text, 'AI 检索服务')
    } catch (e) {
      console.error('AI 返回格式解析失败:', text, e)
      throw new Error('AI 返回的格式无法被成功解析为 JSON 对象，请重试！')
    }
  },

  /**
   * 调用 OpenAI 兼容中转站 API
   */
  async fetchOpenAiQuote(
    baseUrl: string,
    apiKey: string,
    model: string,
    name: string,
    spec: string,
    category: string
  ): Promise<AiQuoteResult> {
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    const url = `${cleanUrl}/chat/completions`

    const categoryText = {
      material: '原材料/建筑材料',
      finished: '成品沥青混合料/水稳成品混合料',
      labor: '人工/劳务工种',
      transport: '成品混合料物流运输费',
      machine: '工程施工机械设备租赁费'
    }[category] || category

    const prompt = `请估算或检索最新关于"中国云南地区"的"${name}"（规格型号为"${spec || '不限'}"，分类为"${categoryText}"）的真实工程行业到场价、市场指导价或信息价。
如果人工工种、机械台班或专项服务缺少公开网页报价，请基于云南工程市场常见水平、施工成本口径和规格描述做保守估算，不要因为缺少公开网页而拒绝返回。
并在汇总多方数据后，挑选或估算一条最合理的数据，按以下标准 JSON 格式进行返回。

JSON 结构定义：
{
  "price": 0.00, // 估算或检索出的单价数字（必须是数值类型，不要带单位如'元'，原材料和成品料通常为'元/t'，人工为'元/工日'，机械为'元/台班'，运输为'元/t·km'）
  "supplier": "信息来源网站名称、参考供应商名称或写'本地行业信息价/市场估价'（不超过40字）",
  "taxCaliber": "税费口径说明，如'含税到场'或'不含税到场'，若不详可用'含税'或'市场指导价'",
  "deliveryPoint": "报价适用点/到场区域，如'昆明'、'云南省内'等",
  "remark": "对价格情况、主要用途或近几个月价格波动的简要说明，如果有参考链接也可以在段尾附上"
}`

    const payload = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' } // 强力约束返回为 JSON 格式
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenAI API 请求失败 (${response.status}): ${errText || '未知错误'}`)
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) {
      throw new Error('未获取到有效的 AI 生成内容')
    }

    try {
      return parseAiQuoteText(text, 'AI 估算服务')
    } catch (e) {
      console.error('OpenAI 返回格式解析失败:', text, e)
      throw new Error('AI 返回的格式无法被成功解析为 JSON 对象，请重试！')
    }
  }
}
