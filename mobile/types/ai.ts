/**
 * AI Types
 * Artificial Intelligence features and integrations
 */

export interface AITagSuggestion {
  tags: string[]
  confidence: number
}

export interface AIRequest {
  content: string
  existingTags: string[]
}

export interface AIRewriteRequest {
  content: string
  tone?: 'professional' | 'casual' | 'concise' | 'detailed' | 'friendly'
}
