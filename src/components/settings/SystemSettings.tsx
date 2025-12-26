import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@radix-ui/react-label'
import { settingsCommands, loadShortcutConfig } from '@/utils/settings-helpers'
import { useSettingsStore } from '@/stores/settings-store'
import { Keyboard, Settings as SettingsIcon } from 'lucide-react'
import { useKeyCapture } from '@/hooks/use-key-capture'
import { LoadingSkeleton } from '@/components/ui/loading/loading-skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SystemSettings() {
  const { autostartEnabled, setAutostartEnabled } = useSettingsStore()
  const [showShortcut, setShowShortcut] = useState('Ctrl+Shift+M')
  const [closeShortcut, setCloseShortcut] = useState('Ctrl+Shift+Q')
  const [loading, setLoading] = useState(false)
  const [autostartLoading, setAutostartLoading] = useState(false)

  const showKeyCapture = useKeyCapture()
  const closeKeyCapture = useKeyCapture()

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const enabled = await settingsCommands.isAutostartEnabled()
      setAutostartEnabled(enabled)

      const shortcutConfig = await loadShortcutConfig()
      if (shortcutConfig) {
        setShowShortcut(shortcutConfig.showShortcut)
        setCloseShortcut(shortcutConfig.closeShortcut)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAutostartToggle(enabled: boolean) {
    setAutostartLoading(true)
    try {
      await settingsCommands.enableAutostart(enabled)
      setAutostartEnabled(enabled)
    } catch (error) {
      console.error('Failed to toggle autostart:', error)
    } finally {
      setAutostartLoading(false)
    }
  }

  useEffect(() => {
    if (showShortcut && closeShortcut) {
      const saveShortcuts = async () => {
        try {
          await settingsCommands.registerShowShortcut(showShortcut)
          await settingsCommands.registerCloseShortcut(closeShortcut)
        } catch (error) {
          console.error('Failed to save shortcuts:', error)
        }
      }

      const timeoutId = setTimeout(saveShortcuts, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [showShortcut, closeShortcut])

  if (loading) {
    return <LoadingSkeleton lines={3} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          <CardTitle>系统设置</CardTitle>
        </div>
        <CardDescription>配置应用的系统级行为和快捷键</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">启用开机自启</Label>
          </div>
          <button
            onClick={() => handleAutostartToggle(!autostartEnabled)}
            disabled={autostartLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autostartEnabled ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autostartEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-sm" htmlFor="showShortcut">
            快速唤出快捷键
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="showShortcut"
              value={
                showKeyCapture.isCapturing
                  ? '按下组合键...'
                  : showKeyCapture.formattedCombo || showShortcut
              }
              readOnly
              onFocus={() => {
                showKeyCapture.startCapture()
              }}
              onBlur={() => {
                if (showKeyCapture.formattedCombo) {
                  setShowShortcut(showKeyCapture.formattedCombo)
                }
                showKeyCapture.stopCapture()
              }}
              placeholder="点击后按下组合键"
              className={showKeyCapture.isCapturing ? 'ring-2 ring-primary' : ''}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (showKeyCapture.isCapturing) {
                  showKeyCapture.stopCapture()
                } else {
                  showKeyCapture.startCapture()
                }
              }}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-sm" htmlFor="closeShortcut">
            快捷关闭快捷键
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="closeShortcut"
              value={
                closeKeyCapture.isCapturing
                  ? '按下组合键...'
                  : closeKeyCapture.formattedCombo || closeShortcut
              }
              readOnly
              onFocus={() => {
                closeKeyCapture.startCapture()
              }}
              onBlur={() => {
                if (closeKeyCapture.formattedCombo) {
                  setCloseShortcut(closeKeyCapture.formattedCombo)
                }
                closeKeyCapture.stopCapture()
              }}
              placeholder="点击后按下组合键"
              className={closeKeyCapture.isCapturing ? 'ring-2 ring-primary' : ''}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (closeKeyCapture.isCapturing) {
                  closeKeyCapture.stopCapture()
                } else {
                  closeKeyCapture.startCapture()
                }
              }}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
