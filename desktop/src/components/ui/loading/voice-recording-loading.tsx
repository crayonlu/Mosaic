import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceRecordingLoadingProps {
  recording: boolean
  duration?: string
  className?: string
}

export function VoiceRecordingLoading({
  recording,
  duration,
  className,
}: VoiceRecordingLoadingProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Mic className={cn('h-4 w-4', recording && 'animate-pulse text-destructive')} />
      <span className="text-sm text-muted-foreground">
        {recording ? `录音中... ${duration || ''}` : '语音输入'}
      </span>
    </div>
  )
}
