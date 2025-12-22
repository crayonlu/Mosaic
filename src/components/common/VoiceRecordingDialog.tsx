import { useEffect, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Mic, Square, X, Loader2 } from 'lucide-react'
import { useInputStore } from '@/stores/input-store'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/utils/time-utils'

interface VoiceRecordingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStop: () => void
  onCancel: () => void
  isProcessing?: boolean
}

export function VoiceRecordingDialog({
  open,
  onOpenChange,
  onStop,
  onCancel,
  isProcessing = false,
}: VoiceRecordingDialogProps) {
  const { recordingDuration, setRecordingDuration, setVoiceRecordingState } =
    useInputStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (open) {
      setRecordingDuration(0)
      setVoiceRecordingState('recording')
      intervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [open, setRecordingDuration, setVoiceRecordingState])


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative rounded-full bg-primary/10 p-6">
              <Mic className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-mono font-semibold text-foreground">
              {formatDuration(recordingDuration)}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {isProcessing ? '正在处理...' : '正在录音...'}
            </div>
          </div>
          <div className="flex items-end justify-center gap-1 h-12 w-full">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1 bg-primary rounded-full',
                  'animate-[wave_1s_ease-in-out_infinite]'
                )}
                style={{
                  animationDelay: `${i * 0.05}s`,
                  height: `${20 + Math.sin(i * 0.5) * 15}%`,
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 w-full">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              disabled={isProcessing}
            >
              <X className="mr-2 h-4 w-4" />
              取消
            </Button>
            <Button
              variant="default"
              onClick={onStop}
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  停止录音
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

