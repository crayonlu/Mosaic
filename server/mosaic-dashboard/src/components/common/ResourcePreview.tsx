import { Image as ImageIcon, Video as VideoIcon } from 'lucide-react'

export function ResourcePreview({
  filename,
  previewUrl,
  type,
  size,
  onRemove,
}: {
  filename: string
  previewUrl: string
  type: 'image' | 'video'
  size?: number
  onRemove: () => void
}) {
  return (
    <div className="relative group w-24 h-24 rounded-lg overflow-hidden border bg-muted">
      {type === 'image' ? (
        <img src={previewUrl} alt={filename} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-black/20">
          <VideoIcon className="w-8 h-8 text-white" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {type === 'image' ? (
          <ImageIcon className="w-4 h-4 text-white" />
        ) : (
          <VideoIcon className="w-4 h-4 text-white" />
        )}
        {size && <span className="text-white text-xs">{(size / 1024).toFixed(0)}KB</span>}
        <button onClick={onRemove} className="text-white hover:text-red-400 transition-colors">
          删除
        </button>
      </div>
    </div>
  )
}
