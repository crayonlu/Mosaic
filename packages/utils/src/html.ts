import { Parser } from 'htmlparser2'

export function extractTextFromHtml(html: string): string {
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
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
          if (text && !text.endsWith('\n')) {
            text += '\n'
          }
        }
      },
    })

    parser.write(html)
    parser.end()

    return text.replace(/\n{3,}/g, '\n\n').trim()
  } catch (error) {
    console.warn('HTML parsing failed, falling back to regex:', error)
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim()
  }
}

export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+[\u4e00-\u9fa5\w]*)/g
  const matches = text.match(hashtagRegex)
  return matches ? matches.map(tag => tag.slice(1)) : []
}

export function extractUrls(text: string): string[] {
  const urlRegex =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi
  return text.match(urlRegex) || []
}
