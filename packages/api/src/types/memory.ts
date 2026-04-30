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
