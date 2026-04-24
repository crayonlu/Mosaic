import { BotEditorSheet } from '@/components/bot/BotEditorSheet'
import { Button, Input, SwitchBtn } from '@/components/ui'
import { pickAndCropAvatar } from '@/components/ui/AvatarCropper'
import { ModelCombobox } from '@/components/ui/ModelCombobox'
import { SlidingSegmentedControl } from '@/components/ui/SlidingSegmentedControl'
import { toast } from '@/components/ui/Toast'
import { getAIConfig, setAIConfig, type AIConfig, type ModelCapabilities } from '@/lib/ai'
import { useBots, useUpdateBot } from '@/lib/query'
import { detectModelCapabilities } from '@mosaic/utils'
// import { useCustomPushCount } from '@/lib/query/hooks/useCustomPush'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { formatBytes, getStorageSummary, type StorageItem } from '@/lib/storage/storageManager'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { resourcesApi } from '@mosaic/api'
import Constants from 'expo-constants'
import { Image } from 'expo-image'
// import { router } from 'expo-router'
import {
  // Bell,
  Bot,
  Info,
  LogOut,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash,
} from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'

const appVersion = Constants.expoConfig?.version ?? 'unknown'
const expandLayoutTransition = LinearTransition.duration(220)

function AvatarImageWithAuth({ avatarUrl }: { avatarUrl: string }) {
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await getBearerAuthHeaders()
      setAuthHeaders(headers)
    }

    loadAuthHeaders()
  }, [])

  return <Image source={{ uri: avatarUrl, headers: authHeaders }} style={styles.avatarImage} />
}

export default function SettingsScreen() {
  const { theme, themeMode, themeName, setThemeMode, setThemeName } = useThemeStore()
  const { user, serverUrl, logout, refreshUser } = useAuthStore()
  // const { data: customPushCount = 0 } = useCustomPushCount()
  const [aiConfig, setLocalAIConfig] = useState<AIConfig | null>(null)
  const [showBotSettings, setShowBotSettings] = useState(false)
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false)
  const [showAISettings, setShowAISettings] = useState(false)
  const [botEditorVisible, setBotEditorVisible] = useState(false)
  const [editingBot, setEditingBot] = useState<import('@mosaic/api').Bot | undefined>(undefined)
  const { data: bots = [] } = useBots()
  const { mutateAsync: updateBot } = useUpdateBot()
  const [showPermissionSettings, setShowPermissionSettings] = useState(false)
  const [savingAI, setSavingAI] = useState(false)
  const [testingAI, setTestingAI] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermissionGranted, setPushPermissionGranted] = useState(false)
  const [showStorageSettings, setShowStorageSettings] = useState(false)
  const [storageItems, setStorageItems] = useState<StorageItem[]>([])
  const [totalStorageSize, setTotalStorageSize] = useState(0)
  const [isLoadingStorage, setIsLoadingStorage] = useState(false)
  const [clearingId, setClearingId] = useState<string | null>(null)
  const [aiCapabilities, setAiCapabilities] = useState<ModelCapabilities | null>(null)
  const [aiDetecting, setAiDetecting] = useState(false)

  useEffect(() => {
    loadAIConfig()
    loadPushStatus()
    loadStorageInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadStorageInfo = useCallback(async () => {
    setIsLoadingStorage(true)
    try {
      const summary = await getStorageSummary()
      setStorageItems(summary.items)
      setTotalStorageSize(summary.totalSize)
    } catch (error) {
      console.error('Failed to load storage info:', error)
    } finally {
      setIsLoadingStorage(false)
    }
  }, [])

  const handleClearStorage = useCallback(
    (item: StorageItem) => {
      if (!item.clearable) return

      const messages: Record<
        string,
        { title: string; message: string; requiresRestart?: boolean }
      > = {
        sqlite: {
          title: '确认清除本地数据',
          message: '清除后需要重启应用才能正常使用，确定吗？',
          requiresRestart: true,
        },
      }
      const { title, message, requiresRestart } = messages[item.id] ?? {
        title: '确认清除',
        message: `确定要清除「${item.label}」吗？`,
      }

      toast.show({
        type: 'warning',
        title,
        message,
        actionLabel: '确定',
        onAction: async () => {
          setClearingId(item.id)
          try {
            await item.clear()
            await loadStorageInfo()

            if (requiresRestart) {
              toast.show({
                type: 'success',
                title: '清除成功',
                message: '应用将在 1 秒后重启',
                duration: 1000,
              })
              setTimeout(async () => {
                const { reloadAppAsync } = await import('expo')
                await reloadAppAsync()
              }, 1000)
            } else {
              toast.show({
                type: 'success',
                title: '清除成功',
                message: `「${item.label}」已清除`,
              })
            }
          } catch (error) {
            console.error('Failed to clear storage:', error)
            toast.show({
              type: 'error',
              title: '清除失败',
              message: String((error as Error).message),
            })
          } finally {
            setClearingId(null)
          }
        },
        duration: 10000,
      })
    },
    [loadStorageInfo]
  )

  const toggleSectionWithAnimation = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(prev => !prev)
  }

  const loadAIConfig = async () => {
    const config = await getAIConfig()
    setLocalAIConfig(config)
    detectCapabilities(config.model, config.baseUrl, config.apiKey)
  }

  const detectCapabilities = useCallback(async (model: string, baseUrl: string, apiKey: string) => {
    if (!model || !baseUrl || !apiKey) {
      setAiCapabilities(null)
      return
    }
    setAiDetecting(true)
    const result = await detectModelCapabilities(baseUrl, apiKey, model)
    setAiCapabilities(result)
    setAiDetecting(false)
  }, [])

  const loadPushStatus = async () => {
    const { LocalPushService } = await import('@/lib/services/local-push')
    const localPush = LocalPushService.getInstance()
    const [enabled, granted] = await Promise.all([
      localPush.isPushEnabled(),
      localPush.getNotificationPermissionStatus(),
    ])
    setPushEnabled(enabled)
    setPushPermissionGranted(granted)
  }

  const handleTogglePush = async (nextEnabled: boolean) => {
    try {
      const { LocalPushService } = await import('@/lib/services/local-push')
      const localPush = LocalPushService.getInstance()

      if (!nextEnabled) {
        await localPush.setPushEnabled(false)
        setPushEnabled(false)
        toast.show({
          type: 'success',
          title: '推送已关闭',
          message: '你可以随时在这里重新开启',
        })
        return
      }

      const granted = await localPush.requestNotificationPermission()
      setPushPermissionGranted(granted)

      if (!granted) {
        setPushEnabled(false)
        toast.show({
          type: 'warning',
          title: '未获得系统权限',
          message: '请先在系统设置中允许通知权限',
        })
        return
      }

      await localPush.setPushEnabled(true)
      await localPush.registerAll()
      setPushEnabled(true)
      toast.show({
        type: 'success',
        title: '推送已开启',
        message: '提醒会按你的配置自动注册',
      })
    } catch (error) {
      console.error('Toggle push error:', error)
      toast.show({
        type: 'error',
        title: '操作失败',
        message: '推送开关更新失败，请稍后重试',
      })
      await loadPushStatus()
    }
  }

  const handleSaveAIConfig = async () => {
    if (!aiConfig) return
    setSavingAI(true)
    try {
      await setAIConfig(aiConfig)
      setShowAISettings(false)
      toast.show({
        type: 'success',
        title: '保存成功',
        message: 'AI 配置已保存',
      })
    } catch (error) {
      console.error('Save AI config error:', error)
      toast.show({
        type: 'error',
        title: '保存失败',
        message: '保存 AI 配置时出错，请检查网络连接',
      })
    } finally {
      setSavingAI(false)
    }
  }

  const handleTestAI = async () => {
    if (!aiConfig?.apiKey?.trim()) {
      setTestResult('error')
      setTestMessage('请先输入 API Key')
      return
    }

    setTestingAI(true)
    setTestResult(null)
    setTestMessage('测试中...')

    try {
      const { createAIAgent } = await import('@/lib/ai/client')
      const agent = createAIAgent(aiConfig)

      const response = await agent.suggestTags('test')
      const tags = response.data.map(t => t.name)

      setTestResult('success')
      setTestMessage(`连接成功！推荐标签: ${tags.join(', ')}`)
      toast.show({
        type: 'success',
        title: 'AI 连接测试成功',
        message: `使用了 ${response.usage.totalTokens} tokens`,
      })
    } catch (error) {
      console.error('AI test error:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setTestResult('error')
      setTestMessage(`连接失败: ${errorMessage}`)
      toast.show({
        type: 'error',
        title: 'AI 连接测试失败',
        message: errorMessage,
      })
    } finally {
      setTestingAI(false)
    }
  }

  const handleAvatarPress = async () => {
    try {
      const croppedUri = await pickAndCropAvatar()
      if (croppedUri) {
        await resourcesApi.uploadAvatar({
          uri: croppedUri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        })
        // Update local user state with new avatar URL
        await refreshUser()
        toast.show({
          type: 'success',
          title: '上传成功',
          message: '头像已更新',
        })
      }
    } catch (error) {
      console.error('Upload avatar error:', error)
      toast.show({
        type: 'error',
        title: '上传失败',
        message: '上传头像时出错',
      })
    }
  }

  const renderAccountSection = () => {
    const avatarUrl = `${serverUrl}${user?.avatarUrl}`
    return (
      <View style={[styles.section]}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={styles.row} onPress={handleAvatarPress}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              {user?.avatarUrl ? (
                <AvatarImageWithAuth avatarUrl={avatarUrl} />
              ) : (
                <Text style={[styles.avatarText, { color: theme.onPrimary }]}>
                  {user?.username?.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: theme.text }]}>
                {user?.username || '未登录'}
              </Text>
              <Text style={[styles.serverUrl, { color: theme.textSecondary }]}>
                {serverUrl || '未配置服务器'}
              </Text>
            </View>
            <Button
              variant="ghost"
              onPress={() => {
                toast.show({
                  type: 'warning',
                  title: '确认登出',
                  message: '确定要退出登录吗？',
                  actionLabel: '确定',
                  onAction: handleLogout,
                  duration: 10000,
                })
              }}
              leftIcon={<LogOut size={18} color={theme.text} />}
            />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderBotSection = () => (
    <View style={[styles.section]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.menuItem, showBotSettings && { borderBottomColor: theme.border }]}
          onPress={() => toggleSectionWithAnimation(setShowBotSettings)}
        >
          <Bot size={18} color={theme.text} />
          <Text style={[styles.menuItemText, { color: theme.text }]}>AI Bot</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>
              {showBotSettings ? '收起' : bots.length > 0 ? `${bots.length} 个 Bot` : '暂无'}
            </Text>
          </View>
        </TouchableOpacity>
        {showBotSettings && (
          <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(240)}
            layout={expandLayoutTransition}
            style={[styles.botSettings, { borderTopColor: theme.border }]}
          >
            {bots.map((bot, index) => (
              <TouchableOpacity
                key={bot.id}
                style={[
                  styles.botItem,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.border,
                  },
                ]}
                activeOpacity={0.82}
                onPress={() => {
                  setEditingBot(bot)
                  setBotEditorVisible(true)
                }}
              >
                <View style={[styles.botAvatar, { backgroundColor: theme.primary }]}>
                  {bot.avatarUrl ? (
                    <Image
                      source={{ uri: bot.avatarUrl }}
                      style={styles.botAvatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={[styles.botAvatarText, { color: theme.onPrimary }]}>
                      {bot.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.botName, { color: theme.text }]}>{bot.name}</Text>
                  {bot.tags.length > 0 && (
                    <Text style={[styles.botTags, { color: theme.textSecondary }]}>
                      {bot.tags.map(t => `#${t}`).join(' ')}
                    </Text>
                  )}
                </View>
                <View onStartShouldSetResponder={() => true}>
                  <SwitchBtn
                    value={bot.autoReply}
                    onValueChange={v => updateBot({ id: bot.id, data: { autoReply: v } })}
                  />
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.addBotBtn,
                {
                  borderTopColor: theme.border,
                  borderTopWidth: bots.length > 0 ? StyleSheet.hairlineWidth : 0,
                },
              ]}
              onPress={() => {
                setEditingBot(undefined)
                setBotEditorVisible(true)
              }}
            >
              <Plus size={16} color={theme.primary} />
              <Text style={[styles.addBotText, { color: theme.primary }]}>添加 Bot</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
      <BotEditorSheet
        visible={botEditorVisible}
        bot={editingBot}
        onClose={() => setBotEditorVisible(false)}
      />
    </View>
  )

  const appearanceSummary = `${themeName === 'quietPaper' ? '暖纸' : '清冷'} · ${themeMode === 'light' ? '浅色' : '深色'}`

  const renderAppearanceSection = () => (
    <View style={[styles.section]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.menuItem, showAppearanceSettings && { borderBottomColor: theme.border }]}
          onPress={() => toggleSectionWithAnimation(setShowAppearanceSettings)}
        >
          <Palette size={18} color={theme.text} />
          <Text style={[styles.menuItemText, { color: theme.text }]}>外观</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>
              {showAppearanceSettings ? '收起' : appearanceSummary}
            </Text>
          </View>
        </TouchableOpacity>
        {showAppearanceSettings && (
          <View style={[styles.appearanceSettings, { borderTopColor: theme.border }]}>
            <View style={styles.appearanceRow}>
              <Text style={[styles.appearanceLabel, { color: theme.textSecondary }]}>配色风格</Text>
              <View style={styles.appearanceControl}>
                <SlidingSegmentedControl
                  options={[
                    { label: '暖纸', value: 'quietPaper' },
                    { label: '清冷', value: 'cleanSlate' },
                  ]}
                  value={themeName}
                  onChange={v => setThemeName(v as 'quietPaper' | 'cleanSlate')}
                  surfaceMuted={theme.surfaceMuted}
                  surface={theme.surface}
                  textColor={theme.text}
                  textMuted={theme.textSecondary}
                  radius={theme.radius.small}
                />
              </View>
            </View>
            <View
              style={[
                styles.appearanceRow,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}
            >
              <Text style={[styles.appearanceLabel, { color: theme.textSecondary }]}>明暗模式</Text>
              <View style={styles.appearanceControl}>
                <SlidingSegmentedControl
                  options={[
                    { label: '浅色', value: 'light' },
                    { label: '深色', value: 'dark' },
                  ]}
                  value={themeMode ?? 'light'}
                  onChange={v => setThemeMode(v as 'light' | 'dark')}
                  surfaceMuted={theme.surfaceMuted}
                  surface={theme.surface}
                  textColor={theme.text}
                  textMuted={theme.textSecondary}
                  radius={theme.radius.small}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  )

  const renderAISettings = () => (
    <View style={[styles.section]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.menuItem, showAISettings && { borderBottomColor: theme.border }]}
          onPress={() => toggleSectionWithAnimation(setShowAISettings)}
        >
          <Sparkles size={18} color={theme.text} />
          <Text style={[styles.menuItemText, { color: theme.text }]}>AI 配置</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>
              {showAISettings ? '隐藏设置' : '显示设置'}
            </Text>
          </View>
        </TouchableOpacity>
        {showAISettings && aiConfig && (
          <View style={[styles.aiSettings, { borderTopColor: theme.border }]}>
            <View style={styles.settingRow}>
              <View style={styles.providerButtons}>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    { backgroundColor: theme.surfaceMuted },
                    aiConfig.provider === 'openai' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setLocalAIConfig({ ...aiConfig, provider: 'openai' })}
                >
                  <Text
                    style={[
                      styles.providerButtonText,
                      aiConfig.provider === 'openai' && { color: theme.onPrimary },
                    ]}
                  >
                    OpenAI
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    { backgroundColor: theme.surfaceMuted },
                    aiConfig.provider === 'anthropic' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setLocalAIConfig({ ...aiConfig, provider: 'anthropic' })}
                >
                  <Text
                    style={[
                      styles.providerButtonText,
                      { color: theme.text },
                      aiConfig.provider === 'anthropic' && { color: theme.onPrimary },
                    ]}
                  >
                    Anthropic
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.settingRow}>
              <Input
                label="API URL"
                value={aiConfig.baseUrl}
                onChangeText={text => setLocalAIConfig({ ...aiConfig, baseUrl: text })}
                placeholder="https://api.openai.com/v1"
                style={styles.aiInputCompact}
              />
            </View>
            <View style={styles.settingRow}>
              <Input
                label="API Key"
                value={aiConfig.apiKey}
                onChangeText={text => setLocalAIConfig({ ...aiConfig, apiKey: text })}
                placeholder="sk-..."
                secureTextEntry
                style={styles.aiInputCompact}
              />
            </View>
            <View style={styles.settingRow}>
              <ModelCombobox
                label="模型"
                value={aiConfig.model}
                onChange={model => {
                  setLocalAIConfig(prev => (prev ? { ...prev, model } : prev))
                  setTimeout(() => {
                    detectCapabilities(model, aiConfig.baseUrl, aiConfig.apiKey)
                  }, 500)
                }}
                baseUrl={aiConfig.baseUrl}
                placeholder={aiConfig.provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514'}
              />
            </View>
            {(aiDetecting ||
              (aiCapabilities &&
                (aiCapabilities.supportsVision ||
                  aiCapabilities.supportsThinking ||
                  (!!aiConfig.model &&
                    !aiCapabilities.supportsVision &&
                    !aiCapabilities.supportsThinking)))) && (
              <View style={styles.capabilityHints}>
                {aiDetecting && (
                  <Text style={[styles.capabilityHint, { color: theme.textSecondary }]}>
                    检测中...
                  </Text>
                )}
                {!aiDetecting &&
                  aiCapabilities &&
                  (aiCapabilities.supportsVision || aiCapabilities.supportsThinking) && (
                    <View style={styles.capabilityRow}>
                      {aiCapabilities.supportsVision && (
                        <Text style={[styles.capabilityHint, { color: theme.textSecondary }]}>
                          ✓ 支持图片输入
                        </Text>
                      )}
                      {aiCapabilities.supportsThinking && (
                        <Text style={[styles.capabilityHint, { color: theme.textSecondary }]}>
                          ✓ 支持心路历程
                        </Text>
                      )}
                    </View>
                  )}
                {!aiDetecting &&
                  aiCapabilities &&
                  !aiCapabilities.supportsVision &&
                  !aiCapabilities.supportsThinking &&
                  aiConfig.model && (
                    <Text style={[styles.capabilityHint, { color: theme.textSecondary }]}>
                      无法识别模型能力，图片和心路历程功能可能不可用
                    </Text>
                  )}
              </View>
            )}
            <View style={styles.settingRow}>
              <Button
                title="测试连接"
                variant="secondary"
                onPress={handleTestAI}
                loading={testingAI}
                disabled={!aiConfig.apiKey?.trim()}
                style={{ flex: 1 }}
              />
              <Button
                title="保存"
                variant="primary"
                onPress={handleSaveAIConfig}
                loading={savingAI}
                disabled={testingAI || !aiConfig.apiKey?.trim()}
                style={{ flex: 1 }}
              />
            </View>
            {testMessage && (
              <View
                style={[
                  styles.testResult,
                  {
                    backgroundColor:
                      testResult === 'success'
                        ? theme.semantic.successSoft
                        : testResult === 'error'
                          ? theme.semantic.errorSoft
                          : theme.semantic.infoSoft,
                    borderColor:
                      testResult === 'success'
                        ? theme.border
                        : testResult === 'error'
                          ? theme.border
                          : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.testResultText,
                    {
                      color:
                        testResult === 'success'
                          ? theme.success
                          : testResult === 'error'
                            ? theme.error
                            : theme.info,
                    },
                  ]}
                >
                  {testMessage}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )

  const renderPermissionSection = () => (
    <View style={[styles.section]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => toggleSectionWithAnimation(setShowPermissionSettings)}
        >
          <ShieldCheck size={18} color={theme.text} />
          <Text style={[styles.menuItemText, { color: theme.text }]}>权限管理</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>
              {showPermissionSettings ? '隐藏设置' : '显示设置'}
            </Text>
          </View>
        </TouchableOpacity>
        {showPermissionSettings && (
          <View style={[styles.permissionSettings, { borderTopColor: theme.border }]}>
            <View>
              <View
                style={{
                  display: 'flex',
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 14,
                      color: theme.text,
                    }}
                  >
                    推送消息
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      color: theme.textSecondary,
                    }}
                  >
                    {pushPermissionGranted
                      ? pushEnabled
                        ? '已开启提醒'
                        : '已关闭提醒'
                      : '系统通知权限未开启'}
                  </Text>
                </View>
                <SwitchBtn value={pushEnabled} onValueChange={handleTogglePush} />
              </View>
            </View>
            {/* <TouchableOpacity
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: theme.border,
                marginTop: 12,
              }}
              onPress={() => router.push('/custom-push')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Bell size={18} color={theme.text} />
                <View>
                  <Text style={{ fontSize: 14, color: theme.text }}>自定义提醒</Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    {customPushCount > 0
                      ? `已设置 ${customPushCount} 条提醒`
                      : '添加自定义推送提醒'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {customPushCount > 0 && (
                  <View
                    style={{
                      backgroundColor: theme.primary,
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      marginRight: 4,
                    }}
                  >
                    <Text style={{ fontSize: 10, color: theme.onPrimary }}>{customPushCount}</Text>
                  </View>
                )}
                <Plus size={16} color={theme.textSecondary} />
              </View>
            </TouchableOpacity> */}
          </View>
        )}
      </View>
    </View>
  )

  const renderAboutSection = () => (
    <View style={[styles.section]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={styles.menuItem}>
          <Info size={18} color={theme.text} />
          <Text style={[styles.menuItemText, { color: theme.text }]}>关于</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>
              Mosaic v{appVersion}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )

  const handleLogout = async () => {
    await logout()
  }

  const renderStorageSection = () => (
    <View style={[styles.section]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.menuItem, showStorageSettings && { borderBottomColor: theme.border }]}
          onPress={() => toggleSectionWithAnimation(setShowStorageSettings)}
        >
          <Trash size={18} color={theme.text} />
          <Text style={[styles.menuItemText, { color: theme.text }]}>存储管理</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>
              {showStorageSettings ? '隐藏' : '显示'} · 共{' '}
              {isLoadingStorage ? '...' : formatBytes(totalStorageSize)}
            </Text>
          </View>
        </TouchableOpacity>
        {showStorageSettings && (
          <View style={[styles.storageSettings, { borderTopColor: theme.border }]}>
            {storageItems.map(item => (
              <View
                key={item.id}
                style={[
                  styles.storageItem,
                  item !== storageItems[0] && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: theme.text, fontWeight: '500' }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    {item.description}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    {item.size > 0 ? formatBytes(item.size) : '—'}
                    {item.itemCount != null && item.itemCount > 0 ? ` · ${item.itemCount} 项` : ''}
                  </Text>
                </View>
                {item.clearable && (
                  <Button
                    variant="ghost"
                    size="small"
                    onPress={() => handleClearStorage(item)}
                    disabled={clearingId === item.id}
                    title={clearingId === item.id ? '清除中...' : '清除'}
                  />
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {renderAccountSection()}
        {renderAppearanceSection()}
        {renderBotSection()}
        {renderAISettings()}
        {renderPermissionSection()}
        {renderStorageSection()}
        {renderAboutSection()}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 12,
    flexDirection: 'column',
    gap: 8,
  },
  section: {},
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '500',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  serverUrl: {
    fontSize: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    gap: 10,
  },
  menuItemText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  menuItemSubText: {
    fontSize: 12,
    flex: 1,
  },
  appearanceSettings: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  appearanceLabel: {
    fontSize: 13,
    flexShrink: 0,
  },
  appearanceControl: {
    width: 140,
  },
  aiSettings: {
    padding: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  permissionSettings: {
    padding: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  storageSettings: {
    paddingHorizontal: 12,
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  storageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visionSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  visionTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  visionHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  providerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  providerButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  providerButtonText: {
    fontSize: 13,
    fontWeight: '400',
  },
  aiInputCompact: {
    fontSize: 14,
    height: 44,
  },
  testResult: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  testResultText: {
    fontSize: 13,
  },
  botSettings: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  botItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  botAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  botAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  botAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  botName: {
    fontSize: 14,
    fontWeight: '500',
  },
  botTags: {
    fontSize: 12,
    marginTop: 2,
  },
  addBotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  addBotText: {
    fontSize: 14,
    fontWeight: '500',
  },
  capabilityHints: {
    marginTop: -2,
    paddingLeft: 2,
  },
  capabilityHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  capabilityRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
})
