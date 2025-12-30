// AI-related type definitions

export interface CompleteTextRequest {
  content: string;
  context?: string;
}

export interface RewriteTextRequest {
  text: string;
  style?: string;
}

export interface SummarizeTextRequest {
  text: string;
  maxLength?: number;
}

export interface SuggestTagsRequest {
  content: string;
  existingTags?: string[];
}

export interface CompleteTextResponse {
  generatedText: string;
}

export interface RewriteTextResponse {
  rewrittenText: string;
}

export interface SummarizeTextResponse {
  summary: string;
}

export interface SuggestTagsResponse {
  tags: string[];
}
