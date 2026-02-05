import { RichTextEditor } from '@/components/common/RichTextEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api-client'
import type { Memo } from '@/types/api'
import { Edit2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SearchInput } from './SearchInput'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Memo[]>([])
  const [loading, setLoading] = useState(false)
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null)
  const [formData, setFormData] = useState({ content: '', tags: [] as string[] })

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const response = await apiClient.getMemos({ page: 1, pageSize: 100, search: query })
      setResults(response.items)
    } catch (error) {
      console.error('搜索失败', error)
      toast.error('搜索失败')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch()
    }, 300)
    return () => clearTimeout(timer)
  }, [handleSearch])

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteMemo(id)
      setResults(results.filter(m => m.id !== id))
      toast.success('删除成功')
    } catch (error) {
      console.error('删除失败', error)
      toast.error('删除失败')
    }
  }

  const openEditDialog = (memo: Memo) => {
    setEditingMemo(memo)
    setFormData({ content: memo.content, tags: memo.tags })
  }

  const handleUpdate = async () => {
    if (!editingMemo) return

    try {
      const updatedMemo = await apiClient.updateMemo(editingMemo.id, {
        content: formData.content,
        tags: formData.tags,
      })
      setResults(results.map(m => (m.id === updatedMemo.id ? updatedMemo : m)))
      setEditingMemo(null)
      toast.success('更新成功')
    } catch (error) {
      console.error('更新失败', error)
      toast.error('更新失败')
    }
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const words = query
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0)
    let result = text
    words.forEach(word => {
      const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      result = result.replace(
        regex,
        '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>'
      )
    })
    return result
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="搜索 memo 内容或标签..."
          className="flex-1 max-w-md"
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? '搜索中...' : '搜索'}
        </Button>
      </div>

      {query && <div className="text-sm text-muted-foreground">找到 {results.length} 条结果</div>}

      <div className="space-y-4">
        {results.map(memo => (
          <Card key={memo.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div
                    className="text-base mb-2 prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: highlightText(memo.content, query) }}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {memo.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                    {memo.isArchived && <Badge variant="outline">已归档</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(memo)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(memo.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {query && results.length === 0 && !loading && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">未找到匹配的结果</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={editingMemo !== null} onOpenChange={() => setEditingMemo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 Memo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editContent">内容</Label>
              <RichTextEditor
                content={formData.content}
                onChange={content => setFormData({ ...formData, content })}
                placeholder="输入 memo 内容..."
                className="min-h-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTags">标签 (逗号分隔)</Label>
              <Input
                id="editTags"
                placeholder="工作, 生活, 学习"
                value={formData.tags?.join(', ')}
                onChange={e =>
                  setFormData({
                    ...formData,
                    tags: e.target.value
                      .split(',')
                      .map(t => t.trim())
                      .filter(t => t),
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMemo(null)}>
              取消
            </Button>
            <Button onClick={handleUpdate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
