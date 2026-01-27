import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/ui/loading/loading-skeleton'
import { useUserStore } from '@/stores/user-store'
import { useAvatarUrl } from '@/utils/avatar-helpers'
import { assetCommands, userCommands } from '@/utils/callRust'
import { Label } from '@radix-ui/react-label'
import { Loader2, User as UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function UserSettings() {
  const { user, loadUser, loading: userLoading } = useUserStore()
  const [username, setUsername] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarUrl = useAvatarUrl(user?.avatarUrl)

  useEffect(() => {
    if (user) {
      setUsername(user.username)
    } else {
      loadUser()
    }
  }, [user])

  useEffect(() => {
    if (user && username !== user.username && username.trim()) {
      const saveUsername = async () => {
        try {
          const updated = await userCommands.updateUser({ username })
          useUserStore.getState().updateUser(updated)
        } catch (error) {
          console.error('Failed to update user:', error)
        }
      }

      const timeoutId = setTimeout(saveUsername, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [username, user])

  async function handleAvatarUpload() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = Array.from(new Uint8Array(arrayBuffer))
      const tempFilePath = await assetCommands.saveTempFile(file.name, uint8Array)
      const updated = await userCommands.uploadAvatar(tempFilePath)
      useUserStore.getState().updateUser(updated)
    } catch (error) {
      console.error('Failed to upload avatar:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (!user || userLoading) {
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
            <AvatarImage src={avatarUrl} alt={user?.username || 'User'} />
            <AvatarFallback>
              <UserIcon className="h-10 w-10" />
            </AvatarFallback>
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
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="输入用户名"
          />
        </div>
      </CardContent>
    </Card>
  )
}
