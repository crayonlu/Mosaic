import { useState, useEffect, useRef } from 'react'
import { SettingsSection } from './SettingsSection'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@radix-ui/react-label'
import { userCommands } from '@/utils/callRust'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User as UserIcon, Loader2 } from 'lucide-react'
import { assetCommands } from '@/utils/callRust'
import { useUserStore } from '@/stores/user-store'
import { useAvatarUrl } from '@/utils/avatar-helpers'

export function UserSettings() {
  const { user, loadUser } = useUserStore()
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarUrl = useAvatarUrl(user?.avatarPath, user?.avatarUrl)

  useEffect(() => {
    if (user) {
      setUsername(user.username)
    } else {
      loadUser()
    }
  }, [user, loadUser])

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await userCommands.updateUser({ username })
      useUserStore.getState().updateUser(updated)
    } catch (error) {
      console.error('Failed to update user:', error)
    } finally {
      setSaving(false)
    }
  }

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

  if (!user) {
    return <div>加载中...</div>
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="用户信息" description="管理您的个人信息">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt={user?.username || 'User'} />
              <AvatarFallback>
                <UserIcon className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                onClick={handleAvatarUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                更换头像
              </Button>
              <p className="text-xs text-muted-foreground">
                支持 PNG、JPG、JPEG、WebP 格式
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="输入用户名"
            />
          </div>

          <div className='flex-1'>
            <Button className='w-full' onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              保存
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}

