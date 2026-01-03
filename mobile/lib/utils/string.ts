import { Parser } from 'htmlparser2'
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
  extractTextFromHtml: (html: string): string => {
    if (!html || html.trim().length === 0) {
      return ''
    }

    try {
      let text = ''
      let skipTag = false

      const parser = new Parser({
        ontext: (data) => {
          if (!skipTag) {
            text += data
          }
        },
        onopentag: (name) => {
          const tagName = name.toLowerCase()
          if (['script', 'style', 'noscript'].includes(tagName)) {
            skipTag = true
          }
        },
        onclosetag: (name) => {
          const tagName = name.toLowerCase()
          if (['script', 'style', 'noscript'].includes(tagName)) {
            skipTag = false
          }
        },
      })

      parser.write(html)
      parser.end()

      return text.trim()
    } catch (error) {
      console.warn('HTML parsing failed, falling back to regex:', error)
      return html.replace(/<[^>]*>/g, '').trim()
    }
  },
  extractHashtags: (text: string): string[] => {
    const hashtagRegex = /#(\w+[\u4e00-\u9fa5\w]*)/g
    const matches = text.match(hashtagRegex)
    return matches ? matches.map(tag => tag.slice(1)) : []
  },
  extractUrls: (text: string): string[] => {
    const urlRegex =
      /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi
    return text.match(urlRegex) || []
  },
  formatRelativeTime: (date: string | Date | number): string => {
    const d = typeof date === 'string' ? new Date(date) : typeof date === 'number' ? new Date(date) : date
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
