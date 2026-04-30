export interface MemoryStats {
  totalMemos: number
  indexedMemos: number
  ongoingEpisodes: number
  resolvedEpisodes: number
  profileSummary: string | null
  profileTopicCount: number
  profileUpdatedAt: number | null
}

export interface MemoryActivityEntry {
  id: string
  botId: string
  botName: string
  memoId: string
  retrievedCount: number
  promptSize: number
  hasEpisode: boolean
  createdAt: number
}

export interface RetrievedMemoItem {
  id: string
  excerpt: string
  score: number
  reason: string
  createdAt: number
}

export interface EpisodeContextItem {
  id: string
  title: string
  summary: string
  status: string
}

export interface MemoryContext {
  retrievedMemos: RetrievedMemoItem[]
  episode: EpisodeContextItem | null
  profileSummary: string | null
}
