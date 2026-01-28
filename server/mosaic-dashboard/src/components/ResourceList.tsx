import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Download, Eye, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '../lib/api-client'
import type { Resource } from '../types/api'

export function ResourceList() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewingResource, setViewingResource] = useState<Resource | null>(null)
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadResources()
  }, [])

  const loadResources = async () => {
    try {
      const response = await apiClient.getResources({ page: 1, pageSize: 100 })
      setResources(response.items)
    } catch (error: unknown) {
      console.error('加载资源失败', error)
      toast.error('加载资源失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadResources()
      return
    }
    // 客户端过滤
    const filtered = resources.filter(r =>
      r.filename.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setResources(filtered)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await apiClient.uploadResource(file)
      toast.success('上传成功')
      loadResources()
    } catch (error: unknown) {
      console.error('上传失败', error)
      toast.error('上传失败')
    }
  }

  const handleDelete = async () => {
    if (!deletingResource) return

    try {
      await apiClient.deleteResource(deletingResource.id)
      setResources(resources.filter(r => r.id !== deletingResource.id))
      setDeletingResource(null)
      toast.success('删除成功')
    } catch (error: unknown) {
      console.error('删除失败', error)
      toast.error('删除失败')
    }
  }

  const handleDownload = (resource: Resource) => {
    window.open(`${resource.url}`, '_blank')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getResourceIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎬'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType.includes('pdf')) return '📄'
    return '📎'
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="搜索资源..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="max-w-xs"
          />
          <Button onClick={handleSearch} size="icon" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            上传资源
          </Button>
        </div>
      </div>

      {resources.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-stone-500">暂无资源</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {resources.map(resource => (
            <Card key={resource.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getResourceIcon(resource.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm truncate">{resource.filename}</CardTitle>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline">{formatFileSize(resource.fileSize)}</Badge>
                      <Badge variant="secondary">{resource.resourceType}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setViewingResource(resource)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(resource)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeletingResource(resource)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 查看资源对话框 */}
      <Dialog open={viewingResource !== null} onOpenChange={() => setViewingResource(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewingResource?.filename}</DialogTitle>
            <DialogDescription>
              {formatFileSize(viewingResource?.fileSize || 0)} · {viewingResource?.mimeType}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {viewingResource?.mimeType.startsWith('image/') ? (
              <img
                src={viewingResource.url}
                alt={viewingResource.filename}
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            ) : (
              <div className="text-center py-8">
                <span className="text-6xl">{getResourceIcon(viewingResource?.mimeType || '')}</span>
                <p className="mt-4 text-stone-500">此文件类型不支持预览</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => viewingResource && handleDownload(viewingResource)}>
              <Download className="h-4 w-4 mr-2" />
              下载
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deletingResource !== null} onOpenChange={() => setDeletingResource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除资源 &quot;{deletingResource?.filename}&quot; 吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingResource(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
