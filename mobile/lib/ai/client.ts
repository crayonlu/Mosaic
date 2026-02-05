import type { AIConfig, AIResponse, TagSuggestion } from './types'

export interface AIAgent {
  suggestTags(content: string): Promise<AIResponse<TagSuggestion[]>>
  completeText(prompt: string): Promise<AIResponse<string>>
  summarizeText(text: string): Promise<AIResponse<string>>
}

export function createAIAgent(config: AIConfig): AIAgent {
  switch (config.provider) {
    case 'openai':
      return new OpenAIAgent(config)
    case 'anthropic':
      return new AnthropicAgent(config)
    default:
      return new OpenAIAgent(config)
  }
}

class OpenAIAgent implements AIAgent {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  async suggestTags(content: string): Promise<AIResponse<TagSuggestion[]>> {
    const prompt = `分析以下内容，提取3-5个相关标签（只返回标签名称，用逗号分隔）：
${content}`

    const response = await this.callAPI(prompt, 100)
    const tags = response.data
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    return {
      data: tags.map(name => ({ name, confidence: 0.8 })),
      usage: response.usage,
    }
  }

  async completeText(prompt: string): Promise<AIResponse<string>> {
    return this.callAPI(prompt, this.config.maxTokens)
  }

  async summarizeText(text: string): Promise<AIResponse<string>> {
    const prompt = `总结以下内容（用简洁的几句话）：
${text}`

    return this.callAPI(prompt, 200)
  }

  private async callAPI(prompt: string, maxTokens: number): Promise<AIResponse<string>> {
    const url = `${this.config.baseUrl}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal: AbortSignal.timeout(this.config.timeout),
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'OpenAI API error')
    }

    const data = await response.json()

    return {
      data: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    }
  }
}

class AnthropicAgent implements AIAgent {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  async suggestTags(content: string): Promise<AIResponse<TagSuggestion[]>> {
    const prompt = `Analyze the following content and extract 3-5 relevant tags (only return tag names, separated by commas):
${content}`

    const response = await this.callAPI(prompt, 100)
    const tags = response.data
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    return {
      data: tags.map(name => ({ name, confidence: 0.8 })),
      usage: response.usage,
    }
  }

  async completeText(prompt: string): Promise<AIResponse<string>> {
    return this.callAPI(prompt, this.config.maxTokens)
  }

  async summarizeText(text: string): Promise<AIResponse<string>> {
    const prompt = `Summarize the following content (in a few concise sentences):
${text}`

    return this.callAPI(prompt, 200)
  }

  private async callAPI(prompt: string, maxTokens: number): Promise<AIResponse<string>> {
    const url = `${this.config.baseUrl}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(this.config.timeout),
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: maxTokens,
        temperature: this.config.temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Anthropic API error')
    }

    const data = await response.json()

    return {
      data: data.content[0].text,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    }
  }
}
