import { AppSettings } from '@/components/settings/AppSettings'
import { BotSettings } from '@/components/settings/BotSettings'
import { MemoryStatusPanel } from '@/components/settings/MemoryStatusPanel'
import { ServerAIConfigSettings } from '@/components/settings/ServerAIConfigSettings'
import { StorageSettings } from '@/components/settings/StorageSettings'
import { SyncStatusDisplay } from '@/components/settings/SyncStatus'
import { SystemSettings } from '@/components/settings/SystemSettings'
import { UserSettings } from '@/components/settings/UserSettings'

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SyncStatusDisplay />
      <UserSettings />
      <AppSettings />
      <StorageSettings />
      <SystemSettings />
      <ServerAIConfigSettings />
      <MemoryStatusPanel />
      <BotSettings />
    </div>
  )
}
