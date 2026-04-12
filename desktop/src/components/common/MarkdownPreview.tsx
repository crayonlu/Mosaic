import { cn } from '@/lib/utils'
import hljs from 'highlight.js'
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { useEffect, useMemo, useRef } from 'react'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const parser = useMemo(() => {
    const instance = MarkdownIt({
      html: false,
      typographer: true,
      breaks: true,
      linkify: true,
      highlight: (str: string, lang: string) => {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
          } catch {
            return instance.utils.escapeHtml(str)
          }
        }

        return instance.utils.escapeHtml(str)
      },
    })
    instance.use(taskLists, { enabled: true, label: true, labelAfter: false })

    instance.renderer.rules.fence = (
      tokens: Array<{ info?: string; content: string }>,
      idx: number,
      options: { highlight?: (str: string, lang: string, attrs: string) => string }
    ) => {
      const token = tokens[idx]
      const rawInfo = (token.info || '').trim()
      const lang = rawInfo ? rawInfo.split(/\s+/g)[0].toLowerCase() : ''
      const escapedLabel = instance.utils.escapeHtml(lang || 'text')
      const languageClass = lang ? ` language-${instance.utils.escapeHtml(lang)}` : ''

      const highlighted = options.highlight
        ? options.highlight(token.content, lang, '')
        : instance.utils.escapeHtml(token.content)

      return `<div class="md-code-block"><div class="md-code-header"><span class="md-code-lang">${escapedLabel}</span><button type="button" class="md-code-copy" data-copy-code>复制</button></div><pre><code class="hljs${languageClass}">${highlighted}</code></pre></div>`
    }

    return instance
  }, [])

  const html = useMemo(() => {
    return parser.render(content ?? '')
  }, [content, parser])

  useEffect(() => {
    const root = containerRef.current
    if (!root) {
      return
    }

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('[data-copy-code]') as HTMLButtonElement | null
      if (!button) {
        return
      }

      const block = button.closest('.md-code-block')
      const code = block?.querySelector('code')
      const value = code?.textContent ?? ''

      if (!value) {
        return
      }

      void navigator.clipboard.writeText(value).then(() => {
        const originalText = button.textContent || '复制'
        button.textContent = '已复制'
        window.setTimeout(() => {
          button.textContent = originalText
        }, 1200)
      })
    }

    root.addEventListener('click', onClick)
    return () => {
      root.removeEventListener('click', onClick)
    }
  }, [html])

  if (!content?.trim()) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={cn('prose prose-sm max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
