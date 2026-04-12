import { MarkdownPreview } from '@/components/common/MarkdownPreview'
import { ResourceThumbnails } from '@/components/common/ResourceThumbnails'
import { cn } from '@/lib/utils'
import type { MemoWithResources } from '@mosaic/api'
import { useEffect, useRef } from 'react'

interface MemoCardProps {
  memo: MemoWithResources
  onClick?: () => void
  searchWords?: string[]
  className?: string
}

export function MemoCard({ memo, onClick, searchWords = [], className }: MemoCardProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editorRef.current || searchWords.length === 0) {
      return
    }

    const highlightText = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''
        if (!text.trim()) {
          return
        }

        if (node.parentElement?.closest('mark')) {
          return
        }

        const intervals: Array<{ start: number; end: number }> = []
        for (const word of searchWords) {
          const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
          let match: RegExpExecArray | null
          while ((match = regex.exec(text)) !== null) {
            intervals.push({ start: match.index, end: match.index + match[0].length })
          }
        }

        intervals.sort((a, b) => a.start - b.start)

        const mergedIntervals: Array<{ start: number; end: number }> = []
        for (const interval of intervals) {
          if (
            mergedIntervals.length === 0 ||
            mergedIntervals[mergedIntervals.length - 1].end < interval.start
          ) {
            mergedIntervals.push(interval)
          } else {
            mergedIntervals[mergedIntervals.length - 1].end = Math.max(
              mergedIntervals[mergedIntervals.length - 1].end,
              interval.end
            )
          }
        }

        if (mergedIntervals.length === 0) {
          return
        }

        let result = ''
        let lastEnd = 0
        for (const interval of mergedIntervals) {
          result += text.slice(lastEnd, interval.start)
          result += `<mark class="rounded px-0.5 bg-primary/20 text-foreground">${text.slice(interval.start, interval.end)}</mark>`
          lastEnd = interval.end
        }
        result += text.slice(lastEnd)

        if (result !== text) {
          const wrapper = document.createElement('span')
          wrapper.innerHTML = result
          const fragment = document.createDocumentFragment()
          while (wrapper.firstChild) {
            fragment.appendChild(wrapper.firstChild)
          }
          node.parentNode?.replaceChild(fragment, node)
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        if (element.tagName === 'MARK') {
          return
        }

        const children = Array.from(node.childNodes)
        children.forEach(child => highlightText(child))
      }
    }

    const observer = new MutationObserver(() => {
      if (!editorRef.current) {
        return
      }

      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node: Node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element
              if (el.tagName === 'MARK') {
                return NodeFilter.FILTER_REJECT
              }
            }
            return NodeFilter.FILTER_ACCEPT
          },
        }
      )

      const textNodes: Node[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node)
        }
      }

      textNodes.forEach(textNode => highlightText(textNode))
    })

    observer.observe(editorRef.current, {
      childList: true,
      subtree: true,
    })

    const timer = window.setTimeout(() => {
      if (!editorRef.current) {
        return
      }

      const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT, null)
      const textNodes: Node[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        textNodes.push(node)
      }

      textNodes.forEach(textNode => highlightText(textNode))
    }, 100)

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [searchWords])

  return (
    <div
      className={cn(
        'group overflow-hidden rounded-xl bg-card/55 text-sm text-card-foreground transition-colors',
        'hover:bg-card/80',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div ref={editorRef}>
        {memo.content ? (
          <MarkdownPreview
            content={memo.content}
            className="p-3 prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1"
          />
        ) : null}
      </div>

      {memo.aiSummary?.trim() && (
        <div className="mt-1 rounded-lg bg-muted/25 px-3 py-2">
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">AI摘要</div>
          <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
            {memo.aiSummary}
          </p>
        </div>
      )}

      {(memo.resources.length > 0 || (memo.tags && memo.tags.length > 0)) && (
        <div className="space-y-3 px-3 pb-3">
          {memo.resources.length > 0 && <ResourceThumbnails resources={memo.resources} />}

          {memo.tags && memo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {memo.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
              {memo.tags.length > 3 && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  +{memo.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
