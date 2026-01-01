import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const dur = dayjs.duration(seconds, 'seconds')
  const mins = dur.minutes()
  const secs = dur.seconds()
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const dur = dayjs.duration(seconds, 'seconds')
  const mins = dur.minutes()
  const secs = dur.seconds()
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
