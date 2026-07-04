export interface MediaGridItem {
  key: string
  uri: string
  type: 'image' | 'video'
  thumbnailUri?: string
  headers?: Record<string, string>
  // Local file:// URI of the asset captured at pick time. When present, the
  // grid tile renders this immediately and swaps to `uri` (remote) once the
  // remote image has actually loaded — avoids blank/broken thumbnails right
  // after memo creation while the server image is still being fetched.
  localUri?: string
}

export interface ResolvedMediaSource {
  item: MediaGridItem
  gridUri?: string
  gridHeaders?: Record<string, string>
  previewLowQualityUri?: string
  previewLowQualityHeaders?: Record<string, string>
  previewUri: string
  previewHeaders?: Record<string, string>
  previewThumbnailUri?: string
  previewThumbnailHeaders?: Record<string, string>
}
