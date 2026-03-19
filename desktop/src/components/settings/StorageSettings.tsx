import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getResourceLoader } from '@mosaic/cache'
import { Label } from '@radix-ui/react-label'
import { Image, Loader2, Video } from 'lucide-react'
import { useEffect, useState } from 'react'

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function StorageSettings() {
  const [totalCacheSize, setTotalCacheSize] = useState(0)
  const [totalCacheCount, setTotalCacheCount] = useState(0)
  const [imageCacheSize, setImageCacheSize] = useState(0)
  const [imageCacheCount, setImageCacheCount] = useState(0)
  const [videoCacheSize, setVideoCacheSize] = useState(0)
  const [videoCacheCount, setVideoCacheCount] = useState(0)
  const [isClearing, setIsClearing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCacheInfo()
  }, [])

  const loadCacheInfo = async () => {
    setIsLoading(true)
    try {
      const loader = await getResourceLoader()
      const usage = await loader.getCacheUsage()
      const imageUsage = usage?.byType?.image
      const videoUsage = usage?.byType?.video

      setTotalCacheSize(usage?.totalSize ?? 0)
      setTotalCacheCount(usage?.itemCount ?? 0)
      setImageCacheSize(imageUsage?.size ?? 0)
      setImageCacheCount(imageUsage?.count ?? 0)
      setVideoCacheSize(videoUsage?.size ?? 0)
      setVideoCacheCount(videoUsage?.count ?? 0)
    } catch (error) {
      console.error('Failed to load cache info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = async () => {
    setIsClearing(true)
    try {
      const loader = await getResourceLoader()
      await loader.clearCache()
      await loadCacheInfo()
    } catch (error) {
      console.error('Failed to clear cache:', error)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>存储管理</CardTitle>
        <CardDescription>管理本地缓存数据，清理缓存不会删除云端数据</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-2">
                  <Image className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-medium">图片缓存</Label>
                  <p className="text-xs text-muted-foreground">已缓存 {imageCacheCount} 个资源</p>
                </div>
              </div>
              <div className="text-sm font-medium">{formatSize(imageCacheSize)}</div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-2">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-medium">视频缓存</Label>
                  <p className="text-xs text-muted-foreground">已缓存 {videoCacheCount} 个资源</p>
                </div>
              </div>
              <div className="text-sm font-medium">{formatSize(videoCacheSize)}</div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-sm font-medium">总缓存大小</Label>
                <p className="text-xs text-muted-foreground">共 {totalCacheCount} 个缓存资源</p>
              </div>
              <div className="text-sm font-medium">{formatSize(totalCacheSize)}</div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleClear}
              disabled={isClearing || totalCacheSize === 0}
            >
              {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              清理缓存
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}