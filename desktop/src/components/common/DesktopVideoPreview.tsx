import '@/lib/solidMedia'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { resourcesApi } from '@mosaic/api'
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type VideoVariant = 'original' | 'thumb' | 'opt'

interface DesktopVideoPreviewProps {
  src: string
  poster?: string
  filename?: string
  className?: string
  variant?: VideoVariant
  autoPlay?: boolean
}

function extractResourceId(url: string): string | null {
  const match = url.match(/\/api\/resources\/([a-f0-9-]+)/i)
  return match ? match[1] : null
}

function resolveVariantSource(source: string, variant: VideoVariant): string {
  const resourceId = extractResourceId(source)
  if (!resourceId || variant === 'original') return source
  return resourcesApi.getDownloadUrl(resourceId, variant)
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'

  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const restSeconds = totalSeconds % 60

  return `${minutes}:${restSeconds.toString().padStart(2, '0')}`
}

export function DesktopVideoPreview({
  src,
  filename,
  className,
  variant = 'original',
  autoPlay = false,
}: DesktopVideoPreviewProps) {
  const hostRef = useRef<HTMLElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [aspectRatio, setAspectRatio] = useState(16 / 9)

  const resolvedSource = useMemo(() => resolveVariantSource(src, variant), [src, variant])
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cleanupVideo: (() => void) | undefined

    const bindVideo = () => {
      const video = host.querySelector('video')
      if (!video || video === videoRef.current) return

      cleanupVideo?.()
      videoRef.current = video
      video.controls = false
      video.playsInline = true
      video.preload = 'metadata'

      const syncMeta = () => {
        setDuration(video.duration || 0)
        setCurrentTime(video.currentTime || 0)
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setAspectRatio(video.videoWidth / video.videoHeight)
        }
        setIsReady(true)
      }
      const syncTime = () => setCurrentTime(video.currentTime || 0)
      const syncPlay = () => setIsPlaying(true)
      const syncPause = () => setIsPlaying(false)
      const syncVolume = () => setIsMuted(video.muted)

      video.addEventListener('loadedmetadata', syncMeta)
      video.addEventListener('timeupdate', syncTime)
      video.addEventListener('play', syncPlay)
      video.addEventListener('pause', syncPause)
      video.addEventListener('ended', syncPause)
      video.addEventListener('volumechange', syncVolume)

      syncMeta()
      syncVolume()

      if (autoPlay) {
        void video.play().catch(() => setIsPlaying(false))
      }

      cleanupVideo = () => {
        video.removeEventListener('loadedmetadata', syncMeta)
        video.removeEventListener('timeupdate', syncTime)
        video.removeEventListener('play', syncPlay)
        video.removeEventListener('pause', syncPause)
        video.removeEventListener('ended', syncPause)
        video.removeEventListener('volumechange', syncVolume)
      }
    }

    bindVideo()

    const observer = new MutationObserver(bindVideo)
    observer.observe(host, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      cleanupVideo?.()
      videoRef.current = null
      setIsReady(false)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setAspectRatio(16 / 9)
    }
  }, [autoPlay, resolvedSource])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play()
      return
    }

    video.pause()
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
  }

  const restart = () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    void video.play()
  }

  const seekTo = (value: string) => {
    const video = videoRef.current
    if (!video || duration <= 0) return
    video.currentTime = (Number(value) / 100) * duration
  }

  return (
    <div
      className={cn(
        'group relative isolate overflow-hidden rounded-2xl bg-[#11110f] text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/10',
        className
      )}
      aria-label={filename ? `预览视频 ${filename}` : '预览视频'}
      style={{
        aspectRatio,
        width: `min(78vw, 860px, calc(72vh * ${aspectRatio}))`,
        maxHeight: '72vh',
      }}
    >
      <solid-media
        key={resolvedSource}
        ref={hostRef}
        src={resolvedSource}
        type="video"
        preload="metadata"
        playsinline
        className="mosaic-video-player block h-full w-full object-contain"
        data-fill="true"
      />

      <button
        type="button"
        className={cn(
          'absolute inset-0 z-20 flex items-center justify-center transition-opacity',
          isPlaying ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
        onClick={togglePlay}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md ring-1 ring-white/25">
          <Play className="ml-1 h-7 w-7" />
        </span>
      </button>

      <div className="absolute inset-x-0 bottom-0 z-30 bg-linear-to-t from-black/70 via-black/30 to-transparent px-4 pb-3 pt-12 opacity-95 transition-opacity group-hover:opacity-100">
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/18">
          <input
            aria-label="视频进度"
            className="mosaic-video-range h-full w-full cursor-pointer"
            style={{ '--video-progress': `${progress}%` } as React.CSSProperties}
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={event => seekTo(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white"
            onClick={restart}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white"
            onClick={toggleMute}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          <div className="ml-auto text-[11px] tabular-nums text-white/75">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      {!isReady && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 text-xs text-white/70">
          加载视频
        </div>
      )}
    </div>
  )
}
