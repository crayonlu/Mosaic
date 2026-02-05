import { DiaryList } from '@/components/DiaryList'
import { Sidebar } from '@/components/layout/Sidebar'
import { MemoList } from '@/components/MemoList'
import { SearchPage } from '@/components/search/SearchPage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '../lib/api-client'
import type { User } from '../types/api'

interface DashboardProps {
  user: User | null
  onLogout: () => void
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('memos')
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

  const renderContent = () => {
    switch (activeTab) {
      case 'memos':
        return <MemoList />
      case 'archive':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <DiaryList />
          </div>
        )
      case 'search':
        return <SearchPage />
      default:
        return <MemoList />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
      <main className="flex-1 overflow-auto p-8">{renderContent()}</main>
    </div>
  )
}
