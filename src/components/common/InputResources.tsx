import { Loader2, Image as ImageIcon, Video as VideoIcon, Mic } from 'lucide-react'
import { useInputStore } from '@/stores/input-store'
import { ResourcePreview } from '@/components/common/ResourcePreview'

export function InputResources() {
  const { resourcePreviews, uploadingFiles, removeResource } = useInputStore()

  const getFileIcon = (type: 'image' | 'audio' | 'video') => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />
      case 'video':
        return <VideoIcon className="h-4 w-4" />
      case 'audio':
        return <Mic className="h-4 w-4" />
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (resourcePreviews.length === 0 && uploadingFiles.length === 0) {
    return null
  }

  const images = resourcePreviews.filter(p => p.type === 'image')
  const videos = resourcePreviews.filter(p => p.type === 'video')
  const audios = resourcePreviews.filter(p => p.type === 'audio')

  return (
    <div className="px-3 py-2 border-t bg-muted/30 space-y-3 w-full">
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map(file => (
            <div key={file.name} className="flex items-center gap-2 rounded-lg border bg-card p-2">
              <div className="flex items-center justify-center h-8 w-8 rounded bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {getFileIcon(file.type)}
                  <span className="text-sm font-medium truncate">{file.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatSize(file.size)} · 上传中...
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {images.map(preview => (
            <ResourcePreview
              key={preview.filename}
              filename={preview.filename}
              previewUrl={preview.previewUrl}
              type={preview.type}
              size={preview.size}
              onRemove={() => removeResource(preview.filename)}
            />
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {videos.map(preview => (
            <ResourcePreview
              key={preview.filename}
              filename={preview.filename}
              previewUrl={preview.previewUrl}
              type={preview.type}
              size={preview.size}
              onRemove={() => removeResource(preview.filename)}
            />
          ))}
        </div>
      )}
      {audios.length > 0 && (
        <div className="space-y-2">
          {audios.map(preview => (
            <ResourcePreview
              key={preview.filename}
              filename={preview.filename}
              previewUrl={preview.previewUrl}
              type={preview.type}
              size={preview.size}
              onRemove={() => removeResource(preview.filename)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
