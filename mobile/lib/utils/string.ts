import { parse } from 'htmlparser2'

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
      const dom = parse(html)
      let text = ''

      const extractText = (node: any): void => {
        if (node.type === 'text') {
          text += node.data || ''
        } else if (node.type === 'tag') {
          const tagName = node.name?.toLowerCase()
          if (tagName && ['script', 'style', 'noscript'].includes(tagName)) {
            return
          }

          if (node.children) {
            for (const child of node.children) {
              extractText(child)
            }
          }
        }
      }

      if (dom && Array.isArray(dom)) {
        for (const child of dom) {
          extractText(child)
        }
      } else if (dom) {
        extractText(dom)
      }

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
