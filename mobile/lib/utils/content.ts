import { extractTextFromHtml } from '@mosaic/utils'

export function isHtmlContent(content: string): boolean {
  if (!content) return false
  const trimmed = content.trim()
  return trimmed.startsWith('<') && trimmed.endsWith('>')
}

export function normalizeContent(content: string): string {
  if (!content) return ''

  if (isHtmlContent(content)) {
    return extractTextFromHtml(content)
  }

  return content
}
