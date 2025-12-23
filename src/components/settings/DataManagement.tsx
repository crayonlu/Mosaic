import { useState } from 'react'
import { SettingsSection } from './SettingsSection'
import { Button } from '@/components/ui/button'
import { memoCommands, diaryCommands } from '@/utils/callRust'
import { callRust } from '@/utils/callRust'
import { Loader2, Download, Trash2 } from 'lucide-react'

export function DataManagement() {
  const [exporting, setExporting] = useState(false)

  async function handleExportMemos() {
    setExporting(true)
    try {
      const memos = await memoCommands.listMemos({ page: 1, pageSize: 10000 })
      const data = JSON.stringify(memos, null, 2)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `memos-export-${timestamp}.json`
      await callRust<string>('export_data', { data, filename })
    } catch (error) {
      console.error('Failed to export memos:', error)
    } finally {
      setExporting(false)
    }
  }

  async function handleExportDiaries() {
    setExporting(true)
    try {
      const diaries = await diaryCommands.listDiaries({ page: 1, pageSize: 10000 })
      const data = JSON.stringify(diaries, null, 2)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `diaries-export-${timestamp}.json`
      await callRust<string>('export_data', { data, filename })
    } catch (error) {
      console.error('Failed to export diaries:', error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="数据导出"
        description="导出您的数据以进行备份或迁移"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div>
              <p className="font-medium">导出备忘录</p>
              <p className="text-sm text-muted-foreground mt-1">
                导出所有备忘录为 JSON 格式
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExportMemos}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              导出
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-md">
            <div>
              <p className="font-medium">导出日记</p>
              <p className="text-sm text-muted-foreground mt-1">
                导出所有日记为 JSON 格式
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExportDiaries}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              导出
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="数据清理"
        description="清理缓存和归档数据"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div>
              <p className="font-medium">清理缓存</p>
              <p className="text-sm text-muted-foreground mt-1">
                清理应用缓存文件
              </p>
            </div>
            <Button variant="outline" disabled>
              <Trash2 className="h-4 w-4 mr-2" />
              清理
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}

