import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Resource } from '@/types/memo'
import { assetCommands } from '@/utils/callRust'
import dayjs from 'dayjs'

interface VoiceListProps {
  resources: Resource[]
  onDelete?: (resourceId: string) => void
  className?: string
}

export function VoiceList({ resources, onDelete, className }: VoiceListProps) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRefsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  const voiceResources = resources.filter(r => r.resourceType === 'voice')

  useEffect(() => {
    return () => {
      audioRefsRef.current.forEach(audio => {
        audio.pause()
        audio.src = ''
      })
      audioRefsRef.current.clear()
    }
  }, [])

  const getAudioUrl = async (resource: Resource): Promise<string> => {
    try {
      const fileData = await assetCommands.readAudioFile(resource.filename)

      const uint8Array = new Uint8Array(fileData)
      const blob = new Blob([uint8Array], { type: resource.mimeType })
      const url = URL.createObjectURL(blob)
      return url
    } catch (error) {
      console.error('加载音频失败:', error)
      throw error
    }
  }

  const handlePlay = async (resource: Resource) => {
    if (playingId === resource.id) {
      const audio = audioRefsRef.current.get(resource.id)
      if (audio) {
        audio.pause()
        setPlayingId(null)
      }
      return
    }

    audioRefsRef.current.forEach(audio => {
      audio.pause()
    })
    setPlayingId(null)

    try {
      let audio = audioRefsRef.current.get(resource.id)
      if (!audio) {
        const audioUrl = await getAudioUrl(resource)
        audio = new Audio(audioUrl)
        audio.onended = () => {
          setPlayingId(null)
        }
        audioRefsRef.current.set(resource.id, audio)
      }

      await audio.play()
      setPlayingId(resource.id)
    } catch (error) {
      console.error('播放音频失败:', error)
    }
  }

  const handleDelete = async (resourceId: string) => {
    if (onDelete) {
      onDelete(resourceId)
    }
  }

  const formatDuration = (createdAt: number) => {
    return dayjs(createdAt).format('HH:mm')
  }

  if (voiceResources.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {voiceResources.map(resource => (
          <div key={resource.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePlay(resource)}
              className="shrink-0"
            >
              {playingId === resource.id ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{resource.filename}</div>
              <div className="text-xs text-muted-foreground">
                {formatDuration(resource.createdAt)} · {(resource.size / 1024).toFixed(1)} KB
              </div>
            </div>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(resource.id)}
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
