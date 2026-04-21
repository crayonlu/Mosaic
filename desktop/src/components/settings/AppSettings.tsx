import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useTheme } from '@/hooks/useTheme'
import { useAppStore } from '@/stores/appStore'
import { Label } from '@radix-ui/react-label'
import { Monitor } from 'lucide-react'

export function AppSettings() {
  const { theme, themeName, setTheme, setThemeName } = useTheme()
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    const selectTrigger = document.querySelector('[data-radix-select-trigger]') as HTMLElement
    if (selectTrigger) {
      const rect = selectTrigger.getBoundingClientRect()
      const x = rect.width / 2
      const y = rect.height / 2
      setTheme(newTheme, x, y)
    } else {
      setTheme(newTheme)
    }
  }

  const handleThemeNameChange = (value: 'quietPaper' | 'cleanSlate') => {
    setThemeName(value)
  }

  const handleSidebarChange = (value: string) => {
    setSidebarOpen(value === 'open')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          <CardTitle>应用设置</CardTitle>
        </div>
        <CardDescription>调整应用的外观和行为偏好</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">配色风格</Label>
            <p className="text-xs text-muted-foreground">选择界面的整体配色方案</p>
          </div>
          <Select value={themeName} onValueChange={handleThemeNameChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quietPaper">暖纸</SelectItem>
              <SelectItem value="cleanSlate">清冷</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">明暗模式</Label>
            <p className="text-xs text-muted-foreground">选择应用的明暗显示模式</p>
          </div>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">浅色</SelectItem>
              <SelectItem value="dark">深色</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">侧边栏默认状态</Label>
            <p className="text-xs text-muted-foreground">应用启动时侧边栏的显示状态</p>
          </div>
          <Select value={sidebarOpen ? 'open' : 'closed'} onValueChange={handleSidebarChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">打开</SelectItem>
              <SelectItem value="closed">关闭</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
