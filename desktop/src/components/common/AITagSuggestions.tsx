import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAI } from '@/hooks/use-ai'
import { AILoadingIndicator } from './AILoadingIndicator'

interface AITagSuggestionsProps {
  content: string
  existingTags: string[]
  onAddTag: (tag: string) => void
  onAddAll?: (tags: string[]) => void
}

export function AITagSuggestions({
  content,
  existingTags,
  onAddTag,
  onAddAll,
}: AITagSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const { suggestTags, loading } = useAI()

  const handleSuggest = async () => {
    if (!content.trim()) {
      return
    }

    setIsOpen(true)
    const result = await suggestTags({
      content,
      existingTags,
    })

    if (result) {
      const filtered = result.tags.filter(tag => !existingTags.includes(tag))
      setSuggestions(filtered)
      if (filtered.length === 0) {
        setIsOpen(false)
      }
    } else {
      setIsOpen(false)
    }
  }

  const handleAddTag = (tag: string) => {
    onAddTag(tag)
    setSuggestions(prev => prev.filter(t => t !== tag))
  }

  const handleAddAll = () => {
    if (onAddAll) {
      onAddAll(suggestions)
    } else {
      suggestions.forEach(tag => onAddTag(tag))
    }
    setSuggestions([])
    setIsOpen(false)
  }

  if (!isOpen && suggestions.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleSuggest}
        disabled={loading || !content.trim()}
        className="gap-2"
      >
        {loading ? (
          <AILoadingIndicator size="sm" inline />
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            AI建议
          </>
        )}
      </Button>
    )
  }

  if (loading || (isOpen && suggestions.length === 0)) {
    return <AILoadingIndicator size="sm" inline />
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-muted/30">
      <span className="text-xs text-muted-foreground">AI建议标签：</span>
      {suggestions.map(tag => (
        <Badge
          key={tag}
          variant="outline"
          className="cursor-pointer hover:bg-primary/10 gap-1"
          onClick={() => handleAddTag(tag)}
        >
          {tag}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      {suggestions.length > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddAll}
          className="h-6 text-xs"
        >
          全部添加
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setIsOpen(false)
          setSuggestions([])
        }}
        className="h-6 text-xs ml-auto"
      >
        关闭
      </Button>
    </div>
  )
}
