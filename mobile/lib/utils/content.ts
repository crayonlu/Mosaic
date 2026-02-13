import { Parser } from 'htmlparser2'

export function isHtmlContent(content: string): boolean {
  if (!content) return false
  const trimmed = content.trim()
  return trimmed.startsWith('<') && trimmed.endsWith('>')
}

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
    console.warn('Failed to parse HTML content, falling back to raw text. Error:', error)
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim()
  }
}

export function normalizeContent(content: string): string {
  if (!content) return ''

  if (isHtmlContent(content)) {
    return extractTextFromHtml(content)
  }

  return content
}
