import { SettingsSection } from './SettingsSection'
import { Label } from '@radix-ui/react-label'
import { useTheme } from '@/hooks/use-theme'
import { useAppStore } from '@/stores/app-store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function AppSettings() {
  const { theme, setTheme } = useTheme()
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <div className="space-y-6">
      <SettingsSection title="外观设置" description="自定义应用的外观">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">主题</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">浅色</SelectItem>
                <SelectItem value="dark">深色</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sidebar">侧边栏默认状态</Label>
            <Select
              value={sidebarOpen ? 'open' : 'closed'}
              onValueChange={value => setSidebarOpen(value === 'open')}
            >
              <SelectTrigger id="sidebar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">打开</SelectItem>
                <SelectItem value="closed">关闭</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}

