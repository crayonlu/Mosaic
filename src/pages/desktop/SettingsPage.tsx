import { useState } from 'react'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { AISettings } from '@/components/settings/AISettings'
import { SystemSettings } from '@/components/settings/SystemSettings'
import { UserSettings } from '@/components/settings/UserSettings'
import { AppSettings } from '@/components/settings/AppSettings'
import { DataManagement } from '@/components/settings/DataManagement'
import { Separator } from '@/components/ui/separator'
import { Bot, Settings as SettingsIcon, User, Monitor, Database } from 'lucide-react'

type SettingsTab = 'ai' | 'system' | 'user' | 'app' | 'data'

const tabs = [
  { id: 'ai' as SettingsTab, label: 'AI配置', icon: Bot },
  { id: 'system' as SettingsTab, label: '系统设置', icon: SettingsIcon },
  { id: 'user' as SettingsTab, label: '用户信息', icon: User },
  { id: 'app' as SettingsTab, label: '应用设置', icon: Monitor },
  { id: 'data' as SettingsTab, label: '数据管理', icon: Database },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai')

  return (
    <DeskTopLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">设置</h1>
        <div className="flex gap-6">
          <div className="w-48 shrink-0">
            <nav className="space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
          <Separator orientation="vertical" />
          <div className="flex-1">
            {activeTab === 'ai' && <AISettings />}
            {activeTab === 'system' && <SystemSettings />}
            {activeTab === 'user' && <UserSettings />}
            {activeTab === 'app' && <AppSettings />}
            {activeTab === 'data' && <DataManagement />}
          </div>
        </div>
      </div>
    </DeskTopLayout>
  )
}

