import dayjs from 'dayjs'
import { Parser } from 'htmlparser2'

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
        ontext: data => {
          if (!skipTag) {
            text += data
          }
        },
        onopentag: name => {
          const tagName = name.toLowerCase()
          if (['script', 'style', 'noscript'].includes(tagName)) {
            skipTag = true
          }
          if (['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
            if (text && !text.endsWith('\n')) {
              text += '\n'
            }
          }
        },
        onclosetag: name => {
          const tagName = name.toLowerCase()
          if (['script', 'style', 'noscript'].includes(tagName)) {
            skipTag = false
          }
          // Add line breaks after closing block-level elements
          if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
            if (text && !text.endsWith('\n')) {
              text += '\n'
            }
          }
        },
      })

      parser.write(html)
      parser.end()

      // Clean up multiple consecutive newlines and trim
      return text.replace(/\n{3,}/g, '\n\n').trim()
    } catch (error) {
      console.warn('HTML parsing failed, falling back to regex:', error)
      return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()
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
