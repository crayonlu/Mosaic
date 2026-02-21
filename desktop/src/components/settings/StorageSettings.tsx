import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCacheSize, getCacheCount, clearCache } from '@/utils/resource-cache'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@radix-ui/react-label'
import { Image, Video, FileText, BookOpen, Loader2 } from 'lucide-react'

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface CacheInfo {
  size: number
  count: number
}

interface BackendCacheStats {
  memo_count: number
  diary_count: number
}

export function StorageSettings() {
  const [imageCache, setImageCache] = useState<CacheInfo>({ size: 0, count: 0 })
  const [videoCache, setVideoCache] = useState<CacheInfo>({ size: 0, count: 0 })
  const [backendCache, setBackendCache] = useState<BackendCacheStats>({
    memo_count: 0,
    diary_count: 0,
  })
  const [isClearing, setIsClearing] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCacheInfo()
  }, [])

  const loadCacheInfo = async () => {
    setIsLoading(true)
    try {
      const [imgSize, imgCount, vidSize, vidCount, backendStats] = await Promise.all([
        getCacheSize('images'),
        getCacheCount('images'),
        getCacheSize('videos'),
        getCacheCount('videos'),
        invoke<BackendCacheStats>('get_cache_stats').catch(() => ({
          memo_count: 0,
          diary_count: 0,
        })),
      ])
      setImageCache({ size: imgSize, count: imgCount })
      setVideoCache({ size: vidSize, count: vidCount })
      setBackendCache(backendStats)
    } catch (error) {
      console.error('Failed to load cache info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = async (type: 'images' | 'videos' | 'backend' | 'all') => {
    setIsClearing(type)
    try {
      if (type === 'images' || type === 'all') {
        await clearCache('images')
      }
      if (type === 'videos' || type === 'all') {
        await clearCache('videos')
      }
      if (type === 'backend' || type === 'all') {
        await invoke('clear_backend_cache')
      }
      await loadCacheInfo()
    } catch (error) {
      console.error('Failed to clear cache:', error)
    } finally {
      setIsClearing(null)
    }
  }

  const totalFrontendSize = imageCache.size + videoCache.size

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">图片缓存</Label>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(imageCache.size)} ({imageCache.count} 张)
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClear('images')}
                disabled={isClearing !== null || imageCache.count === 0}
              >
                {isClearing === 'images' ? <Loader2 className="h-4 w-4 animate-spin" /> : '清理'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">视频缓存</Label>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(videoCache.size)} ({videoCache.count} 个)
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClear('videos')}
                disabled={isClearing !== null || videoCache.count === 0}
              >
                {isClearing === 'videos' ? <Loader2 className="h-4 w-4 animate-spin" /> : '清理'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">备忘录缓存</Label>
                  <p className="text-xs text-muted-foreground">{backendCache.memo_count} 条记录</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsClearing('memos')
                  try {
                    await invoke('clear_memos_cache')
                    await loadCacheInfo()
                  } finally {
                    setIsClearing(null)
                  }
                }}
                disabled={isClearing !== null || backendCache.memo_count === 0}
              >
                {isClearing === 'memos' ? <Loader2 className="h-4 w-4 animate-spin" /> : '清理'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">日记缓存</Label>
                  <p className="text-xs text-muted-foreground">{backendCache.diary_count} 条记录</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsClearing('diaries')
                  try {
                    await invoke('clear_diaries_cache')
                    await loadCacheInfo()
                  } finally {
                    setIsClearing(null)
                  }
                }}
                disabled={isClearing !== null || backendCache.diary_count === 0}
              >
                {isClearing === 'diaries' ? <Loader2 className="h-4 w-4 animate-spin" /> : '清理'}
              </Button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label className="text-sm font-medium">前端缓存总计</Label>
                <p className="text-xs text-muted-foreground">{formatSize(totalFrontendSize)}</p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleClear('all')}
                disabled={
                  isClearing !== null ||
                  (imageCache.count === 0 &&
                    videoCache.count === 0 &&
                    backendCache.memo_count === 0 &&
                    backendCache.diary_count === 0)
                }
              >
                {isClearing === 'all' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isClearing === 'all' ? '清理中...' : '清理全部'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
