import { apiClient } from './client'

export interface SummarizeResponse {
  summary: string
}

export interface SuggestTagsResponse {
  tags: string[]
}

export const aiApi = {
  summarize(content: string): Promise<SummarizeResponse> {
    return apiClient.post<SummarizeResponse>('/api/ai/summarize', { content })
  },

  suggestTags(content: string, existingTags?: string[]): Promise<SuggestTagsResponse> {
    return apiClient.post<SuggestTagsResponse>('/api/ai/suggest-tags', {
      content,
      existing_tags: existingTags ?? [],
    })
  },
}
