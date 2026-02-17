import { AuthImage } from '@/components/common/AuthImage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Image as ImageIcon, X } from 'lucide-react'
import { useState } from 'react'

interface ResourcePreviewProps {
  filename: string
  previewUrl: string
  type: 'image'
  size?: number
  onRemove: () => void
}

export function ResourcePreview({
  filename,
  previewUrl,
  type,
  size,
  onRemove,
}: ResourcePreviewProps) {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (type === 'image') {
    return (
      <>
        <div className="group relative rounded-lg border bg-card overflow-hidden">
          <AuthImage
            src={previewUrl}
            alt={filename}
            className="w-full h-18 object-cover cursor-pointer transition-opacity hover:opacity-90"
            onClick={() => setIsImageModalOpen(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-4 w-4 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <X className="h-1 w-1 text-white" />
          </Button>
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
            {size && <div className="text-[8px] text-white/80">{formatSize(size)}</div>}
          </div>
        </div>
        <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
          <DialogContent className="max-w-4xl p-0">
            <AuthImage
              src={previewUrl}
              alt={filename}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      </>
    )
  }
}
