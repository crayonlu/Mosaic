import { useMemo, useEffect, useRef } from 'react'
import { Image as ImageIcon, Video as VideoIcon, FileText, Volume2 } from 'lucide-react'
import { RichTextEditor } from '@/components/common/RichTextEditor'
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

  const getResourcePreview = (memo: MemoWithResources) => {
    const images = memo.resources.filter(r => r.resourceType === 'image')
    const videos = memo.resources.filter(r => r.resourceType === 'video')
    const audios = memo.resources.filter(r => r.resourceType === 'voice')
    const files = memo.resources.filter(r => r.resourceType === 'file')

    const previews = []
    if (images.length > 0) previews.push({ icon: ImageIcon, count: images.length, label: '图片' })
    if (videos.length > 0) previews.push({ icon: VideoIcon, count: videos.length, label: '视频' })
    if (audios.length > 0) previews.push({ icon: Volume2, count: audios.length, label: '音频' })
    if (files.length > 0) previews.push({ icon: FileText, count: files.length, label: '文件' })

    return previews
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      {results.map(memo => {
        const resourcePreviews = getResourcePreview(memo)

        return (
          <SearchResultItem
            key={memo.id}
            memo={memo}
            resourcePreviews={resourcePreviews}
            searchWords={searchWords}
            onMemoClick={onMemoClick}
          />
        )
      })}
    </div>
  )
}

interface SearchResultItemProps {
  memo: MemoWithResources
  resourcePreviews: Array<{ icon: typeof ImageIcon; count: number; label: string }>
  searchWords: string[]
  onMemoClick?: (memo: MemoWithResources) => void
}

function SearchResultItem({
  memo,
  resourcePreviews,
  searchWords,
  onMemoClick,
}: SearchResultItemProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editorRef.current || searchWords.length === 0) return

    const highlightText = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''
        let highlighted = false

        for (const word of searchWords) {
          if (text.toLowerCase().includes(word.toLowerCase())) {
            highlighted = true
            break
          }
        }

        if (highlighted) {
          let newText = text
          for (const word of searchWords) {
            const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
            newText = newText.replace(
              regex,
              '<mark class="bg-yellow-200 dark:bg-yellow-900 rounded px-0.5">$1</mark>'
            )
          }

          if (newText !== text) {
            const wrapper = document.createElement('span')
            wrapper.innerHTML = newText
            const fragment = document.createDocumentFragment()
            while (wrapper.firstChild) {
              fragment.appendChild(wrapper.firstChild)
            }
            node.parentNode?.replaceChild(fragment, node)
          }
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
      className="group rounded-lg border bg-card overflow-hidden text-sm text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary/50"
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

      {(resourcePreviews.length > 0 || memo.tags.length > 0) && (
        <div className="p-4 border-t">
          {resourcePreviews.length > 0 && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {resourcePreviews.map((preview, index) => {
                const Icon = preview.icon
                return (
                  <div
                    key={index}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>
                      {preview.count} {preview.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {memo.tags && memo.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
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
