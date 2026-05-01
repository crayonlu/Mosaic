import { BotEditorSheet } from '@/components/bot/BotEditorSheet'
import { Button, SwitchBtn } from '@/components/ui'
import { pickAndCropAvatar } from '@/components/ui/AvatarCropper'
import { SlidingSegmentedControl } from '@/components/ui/SlidingSegmentedControl'
import { toast } from '@/components/ui/Toast'
import { useBots, useUpdateBot } from '@/lib/query'
import { useAdminAIConfig } from '@/lib/query/hooks/useAdminAIConfig'
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
  const [showBotSettings, setShowBotSettings] = useState(false)
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false)
  const [showAISettings, setShowAISettings] = useState(false)
  const [botEditorVisible, setBotEditorVisible] = useState(false)
  const [editingBot, setEditingBot] = useState<import('@mosaic/api').Bot | undefined>(undefined)
  const { data: bots = [] } = useBots()
  const { mutateAsync: updateBot } = useUpdateBot()
  const [showPermissionSettings, setShowPermissionSettings] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermissionGranted, setPushPermissionGranted] = useState(false)
  const [showStorageSettings, setShowStorageSettings] = useState(false)
  const [storageItems, setStorageItems] = useState<StorageItem[]>([])
  const [totalStorageSize, setTotalStorageSize] = useState(0)
  const [isLoadingStorage, setIsLoadingStorage] = useState(false)
  const [clearingId, setClearingId] = useState<string | null>(null)
  const { data: adminAiConfig } = useAdminAIConfig()

  useEffect(() => {
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
              setTimeout(async () => {
                const { reloadAppAsync } = await import('expo')
                await reloadAppAsync()
              }, 1000)
            } else {
              await loadStorageInfo()
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

  const maskKey = (key: string) => {
    if (!key) return '未配置'
    if (key.length <= 8) return '••••••••'
    return `${key.slice(0, 4)}••••${key.slice(-4)}`
  }

  const renderAISettings = () => {
    const botConfig = adminAiConfig?.bot
    const embConfig = adminAiConfig?.embedding
    const botConfigured = Boolean(botConfig?.model && botConfig?.apiKey)
    const embConfigured = Boolean(embConfig?.model && embConfig?.apiKey)

    const statusText = showAISettings
      ? '收起'
      : botConfigured && embConfigured
        ? '已配置'
        : botConfigured || embConfigured
          ? '部分配置'
          : '未配置'

    const renderModelCard = (
      label: string,
      config: typeof botConfig,
      configured: boolean,
      pills?: { text: string; show: boolean }[]
    ) => {
      if (!configured) {
        return (
          <View style={styles.aiModelCard}>
            <Text style={[styles.aiCardTypeLabel, { color: theme.textTertiary }]}>{label}</Text>
            <Text style={[styles.aiEmptyText, { color: theme.textTertiary }]}>未配置</Text>
          </View>
        )
      }

      const metaParts = [config!.provider]
      if (config!.apiKey) metaParts.push(maskKey(config!.apiKey))
      if (config!.embeddingDim) metaParts.push(`${config!.embeddingDim} 维`)
      const metaLine = metaParts.filter(Boolean).join('  ·  ')

      const activePills = (pills ?? []).filter(p => p.show)

      return (
        <View style={styles.aiModelCard}>
          <Text style={[styles.aiCardTypeLabel, { color: theme.textSecondary }]}>{label}</Text>
          <View style={styles.aiModelRow}>
            <View style={styles.aiModelLeft}>
              <Text style={[styles.aiModelName, { color: theme.text }]}>{config!.model}</Text>
              {metaLine ? (
                <Text style={[styles.aiModelMeta, { color: theme.textSecondary }]}>{metaLine}</Text>
              ) : null}
            </View>
            {activePills.length > 0 && (
              <Text style={[styles.aiPillText, { color: theme.textSecondary }]}>
                {activePills.map(p => p.text).join('\n')}
              </Text>
            )}
          </View>
        </View>
      )
    }

    return (
      <View style={[styles.section]}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => toggleSectionWithAnimation(setShowAISettings)}
          >
            <Sparkles size={18} color={theme.text} />
            <Text style={[styles.menuItemText, { color: theme.text }]}>AI 配置</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>{statusText}</Text>
            </View>
          </TouchableOpacity>
          {showAISettings && (
            <View style={[styles.aiSettings, { borderTopColor: theme.border }]}>
              {renderModelCard('BOT 模型', botConfig, botConfigured, [
                { text: '图片输入', show: Boolean(botConfig?.supportsVision) },
                { text: '心路历程', show: Boolean(botConfig?.supportsThinking) },
              ])}
              <View style={[styles.aiDivider, { backgroundColor: theme.border }]} />
              {renderModelCard('EMBEDDING 模型', embConfig, embConfigured)}
            </View>
          )}
        </View>
      </View>
    )
  }

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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  aiModelCard: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  aiModelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  aiModelLeft: {
    flex: 1,
  },
  aiModelCardEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiDivider: {
    height: StyleSheet.hairlineWidth,
  },
  aiCardTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  aiModelName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 3,
  },
  aiModelMeta: {
    fontSize: 11,
    marginBottom: 6,
  },
  aiPillText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 20,
  },
  aiEmptyText: {
    fontSize: 11,
    fontWeight: '500',
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
})
