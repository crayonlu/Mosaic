import DeskTopLayout from '@/components/layout/DeskTopLayout'
// import { AISettings } from '@/components/settings/AISettings'
import { SystemSettings } from '@/components/settings/SystemSettings'
import { UserSettings } from '@/components/settings/UserSettings'
import { AppSettings } from '@/components/settings/AppSettings'

export default function SettingsPage() {
  return (
    <DeskTopLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <UserSettings />
        <AppSettings />
        <SystemSettings />
        {/* <AISettings /> */}
      </div>
    </DeskTopLayout>
  )
}
