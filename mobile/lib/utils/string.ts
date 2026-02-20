import dayjs from 'dayjs'
import { extractTextFromHtml, extractHashtags, extractUrls } from '@mosaic/utils'

export const stringUtils = {
  generateId: (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  escapeHtml: (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  },
  isEmpty: (str: string | undefined | null): boolean => {
    return !str || str.trim().length === 0
  },
  extractTextFromHtml,
  extractHashtags,
  extractUrls,
  formatRelativeTime: (date: string | Date | number): string => {
    const d = dayjs(date)
    if (!d.isValid()) {
      console.error('Invalid date provided to formatRelativeTime:', date)
      return '未知时间'
    }

    const now = dayjs()
    const diff = now.diff(d, 'second')

    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`

    return d.format('YYYY年MM月DD日')
  },
  formatDate: (date: string | Date | number): string => {
    return dayjs(date).format('YYYY年MM月DD日')
  },
  formatDateTime: (date: string | Date | number): string => {
    return dayjs(date).format('YYYY年MM月DD日 HH:mm')
  },
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  },
  getTodayDateString: (): string => {
    return dayjs().format('YYYY-MM-DD')
  },
  getDateStringFromTimestamp: (timestamp: number): string => {
    return dayjs(timestamp).format('YYYY-MM-DD')
  },
  getYesterdayDateString: (): string => {
    return dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  },
}
