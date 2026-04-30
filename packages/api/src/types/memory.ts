export interface MemoryStats {
  totalMemos: number
  indexedMemos: number
}

export interface MemoryActivityEntry {
  id: string
  botId: string
  botName: string
  memoId: string
  retrievedCount: number
  promptSize: number
  createdAt: number
}

export interface RetrievedMemoItem {
  id: string
  excerpt: string
  score: number
  reason: string
  createdAt: number
}

export interface MemoryContext {
  retrievedMemos: RetrievedMemoItem[]
}
