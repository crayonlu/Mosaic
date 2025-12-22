import { useState, useRef, useEffect } from 'react'
import { X, Play, Pause, Image as ImageIcon, Video as VideoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface ResourcePreviewProps {
  filename: string
  previewUrl: string
  type: 'image' | 'audio' | 'video'
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
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current = null
      }
    }
  }, [])

  const handlePlayPause = () => {
    if (type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    } else if (type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

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
          <img
            src={previewUrl}
            alt={filename}
            className="w-full h-32 object-cover cursor-pointer transition-opacity hover:opacity-90"
            onClick={() => setIsImageModalOpen(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <X className="h-3 w-3" />
          </Button>
          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
            <div className="text-xs text-white truncate">{filename}</div>
            {size && (
              <div className="text-[10px] text-white/80">{formatSize(size)}</div>
            )}
          </div>
        </div>
        <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
          <DialogContent className="max-w-4xl p-0">
            <img
              src={previewUrl}
              alt={filename}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (type === 'video') {
    return (
      <div className="group relative rounded-lg border bg-card overflow-hidden">
        <video
          ref={videoRef}
          src={previewUrl}
          className="w-full h-32 object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
          <div className="flex items-center gap-1 text-xs text-white">
            <VideoIcon className="h-3 w-3" />
            <span className="truncate">{filename}</span>
          </div>
          {size && (
            <div className="text-[10px] text-white/80">{formatSize(size)}</div>
          )}
        </div>
      </div>
    )
  }

  if (type === 'audio') {
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-3 py-2.5 bg-background">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full shrink-0 hover:bg-primary/10"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 ml-0.5" />
              )}
            </Button>
            <div className="flex-1 min-w-0"></div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              onClick={onRemove}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={previewUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false)
          }}
          className="hidden"
        />
      </div>
    )
  }


  return null
}

