import { AuthImage } from '@/components/common/AuthImage'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/ui/loading/loading-skeleton'
import { resolveApiUrl } from '@/lib/shared-api'
import { apiClient, useUpdateUser, useUser } from '@mosaic/api'
import { Label } from '@radix-ui/react-label'
import { Loader2, User as UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function UserSettings() {
  const { data: user, isLoading, refetch } = useUser()
  const updateUser = useUpdateUser()
  const [username, setUsername] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setUsername(user.username)
    }
  }, [user])

  async function handleAvatarUpload() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const accessToken = await apiClient.getTokenStorage()?.getAccessToken()
      const baseUrl = apiClient.getBaseUrl()
      if (!accessToken || !baseUrl) {
        throw new Error('Missing API configuration or token')
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${baseUrl}/api/resources/upload-avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Avatar upload failed')
      }

      await refetch()
    } catch (error) {
      console.error('Failed to upload avatar:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleUsernameChange = (value: string) => {
    setUsername(value)
    if (user && value !== user.username && value.trim()) {
      updateUser.mutate({ username: value })
    }
  }

  if (isLoading || !user) {
    return <LoadingSkeleton lines={3} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          <CardTitle>用户信息</CardTitle>
        </div>
        <CardDescription>管理您的个人资料和账户信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4">
          <Avatar className="h-20 w-20">
            <AuthImage
              src={resolveApiUrl(user.avatarUrl)}
              alt={user.username || 'User'}
              className="h-full w-full"
            />
          </Avatar>
          <div className="text-center space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={handleAvatarUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              更换头像
            </Button>
            <p className="text-xs text-muted-foreground">支持 PNG、JPG、JPEG、WebP 格式</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium" htmlFor="username">
            用户名
          </Label>
          <Input
            id="username"
            value={username || user.username}
            onChange={e => handleUsernameChange(e.target.value)}
            placeholder="输入用户名"
          />
        </div>
      </CardContent>
    </Card>
  )
}
