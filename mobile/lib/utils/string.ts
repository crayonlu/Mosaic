import i18n from '@/lib/i18n'
import { extractHashtags, extractTextFromHtml, extractUrls } from '@mosaic/utils'
import dayjs from 'dayjs'

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
      return i18n.t('stringUtils.unknownTime')
    }

    const now = dayjs()
    const diff = now.diff(d, 'second')

    if (diff < 60) return i18n.t('stringUtils.justNow')
    if (diff < 3600) return i18n.t('stringUtils.minutesAgo', { n: Math.floor(diff / 60) })
    if (diff < 86400) return i18n.t('stringUtils.hoursAgo', { n: Math.floor(diff / 3600) })
    if (diff < 604800) return i18n.t('stringUtils.daysAgo', { n: Math.floor(diff / 86400) })

    return d.format(i18n.t('stringUtils.dateFormat'))
  },
  formatDate: (date: string | Date | number): string => {
    return dayjs(date).format(i18n.t('stringUtils.dateFormat'))
  },
  formatDateTime: (date: string | Date | number): string => {
    return dayjs(date).format(i18n.t('stringUtils.dateTimeFormat'))
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
