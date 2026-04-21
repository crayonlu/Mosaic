export interface MediaGridItem {
  key: string
  uri: string
  type: 'image' | 'video'
  thumbnailUri?: string
  headers?: Record<string, string>
}

export interface ResolvedMediaSource {
  item: MediaGridItem
  gridUri?: string
  gridHeaders?: Record<string, string>
  previewUri: string
  previewHeaders?: Record<string, string>
  previewThumbnailUri?: string
  previewThumbnailHeaders?: Record<string, string>
}
