import { useMemo, useEffect, useRef } from 'react'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { ResourceThumbnails } from '@/components/common/ResourceThumbnails'
import type { MemoWithResources } from '@/types/memo'
import { cn } from '@/lib/utils'

interface SearchResultsProps {
  results: MemoWithResources[]
  query: string
  onMemoClick?: (memo: MemoWithResources) => void
  className?: string
}

export function SearchResults({ results, query, onMemoClick, className }: SearchResultsProps) {
  const searchWords = useMemo(() => {
    if (!query.trim()) return []
    return query
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
  }, [query])

  if (results.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      {results.map(memo => (
        <SearchResultItem
          key={memo.id}
          memo={memo}
          searchWords={searchWords}
          onMemoClick={onMemoClick}
        />
      ))}
    </div>
  )
}

interface SearchResultItemProps {
  memo: MemoWithResources
  searchWords: string[]
  onMemoClick?: (memo: MemoWithResources) => void
}

function SearchResultItem({ memo, searchWords, onMemoClick }: SearchResultItemProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editorRef.current || searchWords.length === 0) return

    const highlightText = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''
        if (!text.trim()) return

        // Skip if already inside a mark element
        if (node.parentElement?.closest('mark')) return

        // Collect all match intervals
        const intervals: Array<{ start: number; end: number }> = []
        for (const word of searchWords) {
          const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
          let match
          while ((match = regex.exec(text)) !== null) {
            intervals.push({ start: match.index, end: match.index + match[0].length })
          }
        }

        // Sort intervals by start position
        intervals.sort((a, b) => a.start - b.start)

        // Merge overlapping or adjacent intervals
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

        if (mergedIntervals.length === 0) return

        // Build new HTML with merged marks
        let result = ''
        let lastEnd = 0
        for (const interval of mergedIntervals) {
          result += text.slice(lastEnd, interval.start)
          result += `<mark class="rounded px-0.5">${text.slice(interval.start, interval.end)}</mark>`
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
        if (element.tagName === 'MARK') return

        const children = Array.from(node.childNodes)
        children.forEach(child => highlightText(child))
      }
    }

    const observer = new MutationObserver(() => {
      if (editorRef.current) {
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
        let node
        while ((node = walker.nextNode())) {
          if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node)
          }
        }

        textNodes.forEach(textNode => highlightText(textNode))
      }
    })

    if (editorRef.current) {
      observer.observe(editorRef.current, {
        childList: true,
        subtree: true,
      })

      setTimeout(() => {
        if (editorRef.current) {
          const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT, null)

          const textNodes: Node[] = []
          let node
          while ((node = walker.nextNode())) {
            textNodes.push(node)
          }

          textNodes.forEach(textNode => highlightText(textNode))
        }
      }, 100)
    }

    return () => {
      observer.disconnect()
    }
  }, [searchWords])

  return (
    <div
      className="group rounded-lg border bg-card overflow-hidden text-sm text-card-foreground transition-all cursor-pointer hover:border-primary/50"
      onClick={() => onMemoClick?.(memo)}
    >
      <div className="p-4" ref={editorRef}>
        {memo.content ? (
          <RichTextEditor
            content={memo.content}
            onChange={() => {}}
            editable={false}
            className="prose-sm prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1"
          />
        ) : (
          <div className="text-muted-foreground italic">无文字内容</div>
        )}
      </div>

      {(memo.resources.length > 0 || memo.tags.length > 0) && (
        <div className="p-4 border-t space-y-3">
          {memo.resources.length > 0 && <ResourceThumbnails resources={memo.resources} />}

          {memo.tags && memo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {memo.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
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
