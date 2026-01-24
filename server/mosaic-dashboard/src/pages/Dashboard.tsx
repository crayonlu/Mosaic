import { DiaryList } from '@/components/DiaryList'
import { MemoList } from '@/components/MemoList'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '../lib/api-client'
import type { User } from '../types/api'

interface DashboardProps {
  user: User | null
  onLogout: () => void
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [stats, setStats] = useState({
    memoCount: 0,
    diaryCount: 0,
    resourceCount: 0,
  })

  useEffect(() => {
    const loadStats = async () => {
      try {
        const memos = await apiClient.getMemos({ page: 1, pageSize: 1000 })
        const diaries = await apiClient.getDiaries({ page: 1, pageSize: 1000 })

        setStats({
          memoCount: memos.total,
          diaryCount: diaries.total,
          resourceCount: 0,
        })
      } catch (error) {
        console.error('Failed to load stats', error)
      }
    }
    loadStats()
  }, [])

  const handleLogout = () => {
    onLogout()
    toast.success('已退出登录')
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <header className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Mosaic Dashboard</h1>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm text-stone-600 dark:text-stone-400">{user?.username}</span>
          </div>
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarFallback>{user?.username?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button variant="outline" onClick={handleLogout}>
              退出登录
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Memo 数量</CardTitle>
              <CardDescription>总共有 {stats.memoCount} 条记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.memoCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>日记数量</CardTitle>
              <CardDescription>总共 {stats.diaryCount} 天记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.diaryCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>资源数量</CardTitle>
              <CardDescription>总共 {stats.resourceCount} 个文件</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.resourceCount}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="memos" className="w-full">
          <TabsList>
            <TabsTrigger value="memos">Memos</TabsTrigger>
            <TabsTrigger value="diaries">Diaries</TabsTrigger>
          </TabsList>
          <TabsContent value="memos" className="mt-6">
            <MemoList />
          </TabsContent>
          <TabsContent value="diaries" className="mt-6">
            <DiaryList />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
