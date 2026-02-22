import type { AIConfig, AIResponse, TagSuggestion } from './types'

class PromptBuilder {
  static buildCompletePrompt(content: string, context?: string): string {
    const contextPart = context ? `Context: ${context}` : ''

    return `You are a helpful assistant.
You are given a content and a context.
You need to complete the content based on the context.
keep the style and tone of the content.
only output the continuation content and do not repeat the original text.
use the language of the content.
--- here is the content and context starting ---
Content: ${content}
Context: ${contextPart}
--- here is the continuation content ending ---`
  }

  static buildSummarizePrompt(content: string, maxLength?: number): string {
    const maxLengthInstruction = maxLength ? `Max Length: ${maxLength}` : ''

    return `You are a helpful assistant.
You are given a content and a max length.
You need to summarize the content based on the max length.
only output the summarized content and do not repeat the original text.
use the language of the content.
use a space to separate between labels and do not repeat the same label.
--- here is the content and max length starting ---
Content: ${content}
Max Length: ${maxLengthInstruction}
--- here is the summarized content ending ---`
  }

  static buildSuggestTagsPrompt(content: string, existingTags?: string[]): string {
    const existingTagsInstruction = existingTags?.length
      ? `Existing Tags: ${existingTags.join(', ')}`
      : ''

    return `You are a helpful assistant.
You are given a content and existing tags.
You need to suggest 3 to 5 tags for the content based on the existing tags.
only output the suggested tags and do not repeat the existing tags.
use the language of the content.
use a space to divide every two tags.
--- here is the content and existing tags starting ---
Content: ${content}
Existing Tags: ${existingTagsInstruction}
--- here is the suggested tags ending ---`
  }
}

function parseSuggestedTags(raw: string): string[] {
  return raw
    .split(/[,\n\r\t ]+/)
    .map(tag => tag.trim())
    .filter(Boolean)
}

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
    const prompt = PromptBuilder.buildSuggestTagsPrompt(content)

    const response = await this.callAPI(prompt, 100)
    const tags = parseSuggestedTags(response.data)

    return {
      data: tags.map(name => ({ name, confidence: 0.8 })),
      usage: response.usage,
    }
  }

  async completeText(content: string): Promise<AIResponse<string>> {
    const prompt = PromptBuilder.buildCompletePrompt(content)

    return this.callAPI(prompt, this.config.maxTokens)
  }

  async summarizeText(text: string): Promise<AIResponse<string>> {
    const prompt = PromptBuilder.buildSummarizePrompt(text)

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
    const prompt = PromptBuilder.buildSuggestTagsPrompt(content)

    const response = await this.callAPI(prompt, 100)
    const tags = parseSuggestedTags(response.data)

    return {
      data: tags.map(name => ({ name, confidence: 0.8 })),
      usage: response.usage,
    }
  }

  async completeText(content: string): Promise<AIResponse<string>> {
    const prompt = PromptBuilder.buildCompletePrompt(content)

    return this.callAPI(prompt, this.config.maxTokens)
  }

  async summarizeText(text: string): Promise<AIResponse<string>> {
    const prompt = PromptBuilder.buildSummarizePrompt(text)

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
