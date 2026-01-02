export const dateUtils = {
  format: (date: string | Date, format: 'full' | 'short' = 'short'): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const options: Intl.DateTimeFormatOptions =
      format === 'full'
        ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: 'numeric' }
    return d.toLocaleDateString('zh-CN', options)
  },
  relativeTime: (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    return `${year}年${month}月${day}日`
  },
  today: (): string => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  },
  isToday: (date: string | Date): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date
    const today = new Date()
    return d.toDateString() === today.toDateString()
  },
  startOfDay: (date: string | Date): Date => {
    const d = typeof date === 'string' ? new Date(date) : date
    d.setHours(0, 0, 0, 0)
    return d
  },
  endOfDay: (date: string | Date): Date => {
    const d = typeof date === 'string' ? new Date(date) : date
    d.setHours(23, 59, 59, 999)
    return d
  },
  getWeekNumber: (date: string | Date): number => {
    const d = typeof date === 'string' ? new Date(date) : date
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 4 - (d.getDay() || 7))
    const yearStart = new Date(d.getFullYear(), 0, 1)
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  },
}
