import { AuthImage } from '@/components/common/AuthImage'
import { DesktopVideoPreview } from '@/components/common/DesktopVideoPreview'
import { ZoomableImagePreview } from '@/components/common/ZoomableImagePreview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Image as ImageIcon, Video } from 'lucide-react'
import { useState } from 'react'

interface ResourcePreviewProps {
  filename: string
  previewUrl: string
  type: 'image' | 'video'
  size?: number
  compact?: boolean
  onRemove: () => void
}

export function ResourcePreview({
  filename,
  previewUrl,
  type,
  size,
  compact = false,
  onRemove,
}: ResourcePreviewProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      {type === 'video' ? (
        <div
          className="group relative rounded-lg border bg-card overflow-hidden cursor-pointer"
          onClick={() => setPreviewOpen(true)}
        >
          <div
            className={cn(
              'flex w-full items-center justify-center bg-black/80 transition-opacity hover:opacity-90',
              compact ? 'h-14' : 'h-18'
            )}
          />
          <Video className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white" />
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'absolute top-1 right-1 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity',
              compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
            )}
            onClick={e => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <span className={cn('text-white', compact ? 'text-[7px]' : 'text-[8px]')}>×</span>
          </Button>
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
            {size && <div className="text-[8px] text-white/80">{formatSize(size)}</div>}
          </div>
        </div>
      ) : (
        <div className="group relative rounded-lg border bg-card overflow-hidden">
          <AuthImage
            src={previewUrl}
            variant="thumb"
            alt={filename}
            className={cn(
              'w-full object-cover cursor-pointer transition-opacity hover:opacity-90',
              compact ? 'h-14' : 'h-18'
            )}
            onClick={() => setPreviewOpen(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'absolute top-1 right-1 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity',
              compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
            )}
            onClick={e => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <span className={cn('text-white', compact ? 'text-[7px]' : 'text-[8px]')}>×</span>
          </Button>
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
            {size && <div className="text-[8px] text-white/80">{formatSize(size)}</div>}
          </div>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={open => !open && setPreviewOpen(false)}>
        <DialogContent
          aria-describedby={undefined}
          className="left-1/2 top-1/2 flex w-screen max-w-none -translate-x-1/2 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 shadow-none"
        >
          <DialogTitle className="sr-only">资源预览</DialogTitle>
          {type === 'video' ? (
            <div className="relative flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] items-center justify-center">
              <DesktopVideoPreview src={previewUrl} variant="opt" filename={filename} />
            </div>
          ) : (
            <div className="relative flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] items-center justify-center">
              <ZoomableImagePreview src={previewUrl} variant="opt" alt={filename} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
