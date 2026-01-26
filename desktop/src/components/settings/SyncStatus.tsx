import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useServerConfig } from '@/hooks/use-server-config'
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SyncStatusDisplay() {
  const { isConfigured, loading, config, checkConfig } = useServerConfig()

  const getStatus = () => {
    if (loading) {
      return { icon: RefreshCw, text: '检查中...', variant: 'secondary' as const }
    }
    if (!isConfigured) {
      return { icon: CloudOff, text: '未配置', variant: 'destructive' as const }
    }
    return { icon: Cloud, text: '已连接', variant: 'default' as const }
  }

  const { icon: StatusIcon, text, variant } = getStatus()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            <CardTitle>服务器同步</CardTitle>
          </div>
          <Badge variant={variant} className="gap-1">
            <StatusIcon className="h-3 w-3" />
            {text}
          </Badge>
        </div>
        <CardDescription>
          {isConfigured ? '已连接到服务器，数据将自动同步' : '配置服务器以启用云端数据同步功能'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {config && isConfigured ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">服务器地址</span>
              <span>{config.url}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">用户名</span>
              <span>{config.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">AI 提供商</span>
              <span className="capitalize">{config.aiProvider}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>请先完成服务器配置向导</span>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={checkConfig} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新状态
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
