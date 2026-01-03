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
}
