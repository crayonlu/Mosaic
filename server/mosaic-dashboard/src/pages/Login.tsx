import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { toast } from 'sonner'

interface LoginProps {
  onLogin: (serverUrl: string, username: string, password: string) => Promise<void>
}

export function Login({ onLogin }: LoginProps) {
  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'
  const [serverUrl, setServerUrl] = useState(currentOrigin)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onLogin(serverUrl, username, password)
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string } } }
      toast.error(axiosError.response?.data?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-50 dark:bg-stone-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Mosaic Dashboard</CardTitle>
          <CardDescription>登录到您的 Mosaic 服务器</CardDescription>
        </CardHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serverUrl">服务器地址</Label>
              <Input
                id="serverUrl"
                type="url"
                placeholder={currentOrigin}
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
