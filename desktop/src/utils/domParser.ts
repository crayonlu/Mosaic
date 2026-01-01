/**
 * Convert HTML string to plain text using DOMParser or a safe fallback.
 * Handles large/complex HTML more efficiently and safely than regex.
 */
export function htmlToText(html?: string): string {
  if (!html) return ''
  try {
    if (typeof window !== 'undefined' && 'DOMParser' in window) {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      return doc.body.textContent?.trim() ?? ''
    } else if (typeof document !== 'undefined') {
      const div = document.createElement('div')
      div.innerHTML = html
      return (div.textContent || div.innerText || '').trim()
    }
  } catch {
    // Fallthrough to regex fallback
  }
  return html.replace(/<[^>]*>/g, '').trim()
}
