import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { AISettings } from '@/components/settings/AISettings'
import { AppSettings } from '@/components/settings/AppSettings'
import { SyncStatusDisplay } from '@/components/settings/SyncStatus'
import { SystemSettings } from '@/components/settings/SystemSettings'
import { UserSettings } from '@/components/settings/UserSettings'

export default function SettingsPage() {
  return (
    <DeskTopLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <SyncStatusDisplay />
        <UserSettings />
        <AppSettings />
        <SystemSettings />
        <AISettings />
      </div>
    </DeskTopLayout>
  )
}
