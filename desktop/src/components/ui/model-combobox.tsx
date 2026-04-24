import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { fetchAvailableModels } from '@mosaic/utils'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

interface ModelComboboxProps {
  id?: string
  value: string
  onChange: (model: string) => void
  baseUrl: string
  placeholder?: string
}

export function ModelCombobox({
  id,
  value,
  onChange,
  baseUrl,
  placeholder = 'gpt-4o',
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return models
    return models.filter(model => model.toLowerCase().includes(keyword))
  }, [models, search])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [open])

  const loadModels = async () => {
    if (!baseUrl.trim()) return
    setLoading(true)
    setFetchError(null)
    try {
      const list = await fetchAvailableModels(baseUrl)
      setModels(list)
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : '获取失败')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearch('')
      return
    }
    setSearch('')
    void loadModels()
  }

  const handleSelect = (model: string) => {
    onChange(model)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            'border-input bg-transparent hover:bg-accent/40 flex h-9 w-full items-center gap-2 rounded-md border px-3 text-sm shadow-none outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
          )}
        >
          <span className={cn('truncate text-left flex-1', !value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="border-b p-3">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="搜索或输入模型名..."
              autoCapitalize="none"
              autoCorrect="off"
              onKeyDown={event => {
                if (event.key === 'Enter' && search.trim()) {
                  event.preventDefault()
                  handleSelect(search.trim())
                }
              }}
            />
            {search.trim() && (
              <Button type="button" size="sm" onClick={() => handleSelect(search.trim())}>
                使用
              </Button>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            获取模型列表...
          </div>
        )}

        {!loading && fetchError && (
          <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm">
            <span className="text-destructive">
              {fetchError === '401' ? '当前 URL 未授权访问模型列表' : `获取失败: ${fetchError}`}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void loadModels()}>
              重试
            </Button>
          </div>
        )}

        {!loading && !fetchError && models.length === 0 && !search.trim() && (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            {!baseUrl.trim() ? '请先填写 API URL' : '未获取到模型列表'}
          </div>
        )}

        {!loading && !fetchError && (
          <div className="max-h-72 overflow-y-auto py-1">
            {filteredModels.map(model => (
              <button
                key={model}
                type="button"
                className={cn(
                  'hover:bg-accent flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                  model === value && 'bg-accent/70'
                )}
                onClick={() => handleSelect(model)}
              >
                <span className="flex-1 truncate">{model}</span>
                {model === value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
            {filteredModels.length === 0 && search.trim() && (
              <div className="px-3 py-4 text-sm text-muted-foreground">没有匹配的模型</div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
