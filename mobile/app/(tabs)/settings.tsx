import { BotEditorSheet } from '@/components/bot/BotEditorSheet'
import { Button, SwitchBtn } from '@/components/ui'
import { pickAndCropAvatar } from '@/components/ui/AvatarCropper'
import { SlidingSegmentedControl } from '@/components/ui/SlidingSegmentedControl'
import { toast } from '@/components/ui/Toast'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { useAuthHeaders } from '@/hooks/useAuthHeaders'
import { useBots, useUpdateBot } from '@/lib/query'
import { useAdminAIConfig } from '@/lib/query/hooks/useAdminAIConfig'
// import { useCustomPushCount } from '@/lib/query/hooks/useCustomPush'
import { formatBytes, getStorageSummary, type StorageItem } from '@/lib/storage/storageManager'
import { useAuthStore } from '@/stores/authStore'
import { useLocaleStore } from '@/stores/localeStore'
import { useThemeStore } from '@/stores/themeStore'
import { resourcesApi } from '@mosaic/api'
import Constants from 'expo-constants'
import { Image } from 'expo-image'
// import { router } from 'expo-router'
import { Bot, Cog, Info, LogOut, Plus, ShieldCheck, Sparkles, Trash } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TouchableOpacity as RNTouchableOpacity,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const TouchableOpacity = (props: React.ComponentProps<typeof RNTouchableOpacity>) => (
  <RNTouchableOpacity activeOpacity={1} {...props} />
)

const appVersion = Constants.expoConfig?.version ?? 'unknown'
function CollapsibleContent({
  expanded,
  children,
  style,
}: {
  expanded: boolean
  children: React.ReactNode
  style?: any
}) {
  const [contentHeight, setContentHeight] = useState(0)
  const animHeight = useSharedValue(0)

  useEffect(() => {
    animHeight.value = withTiming(expanded ? contentHeight : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    })
  }, [expanded, contentHeight, animHeight])

  const clipStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
    overflow: 'hidden' as const,
  }))

  return (
    <Animated.View style={clipStyle}>
      <View
        onLayout={e => {
          const h = e.nativeEvent.layout.height
          if (h > 0 && h !== contentHeight) setContentHeight(h)
        }}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, style]}
      >
        {children}
      </View>
    </Animated.View>
  )
}

interface SettingsSectionProps {
  icon: React.ReactNode
  title: string
  summary: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  contentStyle?: any
  badge?: React.ReactNode
}

function SettingsSection({
  icon,
  title,
  summary,
  expanded,
  onToggle,
  children,
  contentStyle,
  badge,
}: SettingsSectionProps) {
  const { theme } = useThemeStore()

  return (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.menuItem, expanded && { borderBottomColor: theme.border }]}
          onPress={onToggle}
        >
          {icon}
          <Text style={[styles.menuItemText, { color: theme.text }]}>{title}</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>{summary}</Text>
          </View>
          {badge}
        </TouchableOpacity>
        <CollapsibleContent
          expanded={expanded}
          style={[
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            contentStyle,
          ]}
        >
          {children}
        </CollapsibleContent>
      </View>
    </View>
  )
}

function AvatarImageWithAuth({ avatarUrl }: { avatarUrl: string }) {
  const { headers: authHeaders } = useAuthHeaders()

  return <Image source={{ uri: avatarUrl, headers: authHeaders }} style={styles.avatarImage} />
}

function BotAvatarImageWithAuth({ avatarUrl }: { avatarUrl: string }) {
  const { headers: authHeaders } = useAuthHeaders()

  return (
    <Image
      source={{ uri: avatarUrl, headers: authHeaders }}
      style={styles.botAvatarImage}
      contentFit="cover"
    />
  )
}

export default function SettingsScreen() {
  const { t } = useTranslation()
  const { theme, themeName, setThemeName } = useThemeStore()
  const { locale, setLocale } = useLocaleStore()
  const { user, serverUrl, logout, refreshUser } = useAuthStore()
  const appUpdate = useAppUpdate()
  // const { data: customPushCount = 0 } = useCustomPushCount()
  const [showBotSettings, setShowBotSettings] = useState(false)
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false)
  const [showAISettings, setShowAISettings] = useState(false)
  const [showAboutSettings, setShowAboutSettings] = useState(false)
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
          title: t('settings.confirmClearData'),
          message: t('settings.clearRestartMsg'),
          requiresRestart: true,
        },
      }
      const { title, message, requiresRestart } = messages[item.id] ?? {
        title: t('settings.confirmClear'),
        message: t('settings.clearItemMsg', { label: item.label }),
      }

      toast.show({
        type: 'warning',
        title,
        message,
        actionLabel: t('common.confirm'),
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
              title: t('settings.clearFailed'),
              message: String((error as Error).message),
            })
          } finally {
            setClearingId(null)
          }
        },
        duration: 10000,
      })
    },
    [t, loadStorageInfo]
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
          title: t('settings.noPushPermission'),
          message: t('settings.pushHint'),
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
        title: t('error.operationFailed'),
        message: t('error.pushToggleFailed'),
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
        title: t('error.uploadFailed'),
        message: t('settings.avatarUploadError'),
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
                {user?.username || t('settings.notLoggedIn')}
              </Text>
              <Text style={[styles.serverUrl, { color: theme.textSecondary }]}>
                {serverUrl || t('settings.noServer')}
              </Text>
            </View>
            <Button
              variant="ghost"
              onPress={() => {
                toast.show({
                  type: 'warning',
                  title: t('settings.confirmLogout'),
                  message: t('settings.logoutConfirmMsg'),
                  actionLabel: t('common.confirm'),
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
    <>
      <SettingsSection
        icon={<Bot size={18} color={theme.text} />}
        title={t('settings.aiBot')}
        summary={
          showBotSettings
            ? t('settings.collapsed')
            : bots.length > 0
              ? t('settings.botsCount', { count: bots.length })
              : t('settings.none')
        }
        expanded={showBotSettings}
        onToggle={() => toggleSectionWithAnimation(setShowBotSettings)}
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
            activeOpacity={1}
            onPress={() => {
              setEditingBot(bot)
              setBotEditorVisible(true)
            }}
          >
            <View style={[styles.botAvatar, { backgroundColor: theme.primary }]}>
              {bot.avatarUrl ? (
                <BotAvatarImageWithAuth avatarUrl={bot.avatarUrl} />
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
          <Text style={[styles.addBotText, { color: theme.primary }]}>{t('settings.addBot')}</Text>
        </TouchableOpacity>
      </SettingsSection>
      <BotEditorSheet
        visible={botEditorVisible}
        bot={editingBot}
        onClose={() => setBotEditorVisible(false)}
      />
    </>
  )

  const generalSummary =
    (themeName === 'quietPaper' ? t('settings.quietPaper') : t('settings.cleanSlate')) +
    ' · ' +
    (locale === 'zh' ? t('settings.languageZh') : 'EN')

  const renderGeneralSection = () => (
    <SettingsSection
      icon={<Cog size={18} color={theme.text} />}
      title={t('settings.general')}
      summary={showAppearanceSettings ? t('settings.collapsed') : generalSummary}
      expanded={showAppearanceSettings}
      onToggle={() => toggleSectionWithAnimation(setShowAppearanceSettings)}
    >
      <View style={styles.appearanceRow}>
        <Text style={[styles.appearanceLabel, { color: theme.textSecondary }]}>
          {t('settings.theme')}
        </Text>
        <View style={styles.appearanceControl}>
          <SlidingSegmentedControl
            options={[
              { label: t('settings.quietPaper'), value: 'quietPaper' },
              { label: t('settings.cleanSlate'), value: 'cleanSlate' },
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
          {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
            paddingTop: 14,
            marginTop: 4,
          },
        ]}
      >
        <Text style={[styles.appearanceLabel, { color: theme.textSecondary }]}>
          {t('settings.language')}
        </Text>
        <View style={styles.appearanceControl}>
          <SlidingSegmentedControl
            options={[
              { label: t('settings.languageZh'), value: 'zh' },
              { label: 'EN', value: 'en' },
            ]}
            value={locale}
            onChange={v => setLocale(v as 'zh' | 'en')}
            surfaceMuted={theme.surfaceMuted}
            surface={theme.surface}
            textColor={theme.text}
            textMuted={theme.textSecondary}
            radius={theme.radius.small}
          />
        </View>
      </View>
    </SettingsSection>
  )

  const maskKey = (key: string) => {
    if (!key) return t('settings.notConfigured')
    if (key.length <= 8) return '••••••••'
    return `${key.slice(0, 4)}••••${key.slice(-4)}`
  }

  const renderAISettings = () => {
    const botConfig = adminAiConfig?.bot
    const embConfig = adminAiConfig?.embedding
    const botConfigured = Boolean(botConfig?.model && botConfig?.apiKey)
    const embConfigured = Boolean(embConfig?.model && embConfig?.apiKey)

    const statusText = showAISettings
      ? t('settings.collapsed')
      : botConfigured && embConfigured
        ? t('settings.configured')
        : botConfigured || embConfigured
          ? t('settings.partialConfig')
          : t('settings.notConfigured')

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
            <Text style={[styles.aiEmptyText, { color: theme.textTertiary }]}>
              {t('settings.notConfigured')}
            </Text>
          </View>
        )
      }

      const metaParts = [config!.provider]
      if (config!.apiKey) metaParts.push(maskKey(config!.apiKey))
      if (config!.embeddingDim) metaParts.push(`${config!.embeddingDim}${t('settings.dimensions')}`)
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
      <SettingsSection
        icon={<Sparkles size={18} color={theme.text} />}
        title={t('settings.aiConfig')}
        summary={statusText}
        expanded={showAISettings}
        onToggle={() => toggleSectionWithAnimation(setShowAISettings)}
        contentStyle={styles.aiSettings}
      >
        {renderModelCard(t('settings.botModel'), botConfig, botConfigured, [
          { text: t('settings.supportsVision'), show: Boolean(botConfig?.supportsVision) },
          { text: t('settings.supportsThinking'), show: Boolean(botConfig?.supportsThinking) },
        ])}
        <View style={[styles.aiDivider, { backgroundColor: theme.border }]} />
        {renderModelCard(t('settings.embeddingModel'), embConfig, embConfigured)}
      </SettingsSection>
    )
  }

  const renderPermissionSection = () => (
    <SettingsSection
      icon={<ShieldCheck size={18} color={theme.text} />}
      title={t('settings.permissions')}
      summary={showPermissionSettings ? t('settings.collapsed') : t('settings.expanded')}
      expanded={showPermissionSettings}
      onToggle={() => toggleSectionWithAnimation(setShowPermissionSettings)}
      contentStyle={styles.permissionSettings}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, color: theme.text }}>{t('settings.pushMessages')}</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: theme.textSecondary }}>
            {pushPermissionGranted
              ? pushEnabled
                ? t('settings.pushEnabled')
                : t('settings.pushDisabled')
              : t('settings.pushNoPermission')}
          </Text>
        </View>
        <SwitchBtn value={pushEnabled} onValueChange={handleTogglePush} />
      </View>
    </SettingsSection>
  )

  const renderAboutSection = () => (
    <SettingsSection
      icon={<Info size={18} color={theme.text} />}
      title={t('settings.about')}
      summary={showAboutSettings ? t('settings.collapsed') : `v${appVersion}`}
      expanded={showAboutSettings}
      onToggle={() => toggleSectionWithAnimation(setShowAboutSettings)}
      badge={
        appUpdate.hasUpdate && !appUpdate.downloading ? (
          <View
            style={[
              styles.updateBadge,
              { backgroundColor: theme.primary, borderRadius: theme.radius.small },
            ]}
          >
            <Text style={[styles.updateBadgeText, { color: theme.onPrimary }]}>
              {t('settings.update')}
            </Text>
          </View>
        ) : undefined
      }
    >
      <View style={styles.aboutRow}>
        <Text style={[styles.aboutLabel, { color: theme.textSecondary }]}>
          {t('settings.version')}
        </Text>
        <Text style={[styles.aboutValue, { color: theme.text }]}>Mosaic v{appVersion}</Text>
      </View>
      <View
        style={[
          styles.aboutRow,
          { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
        ]}
      >
        <Text style={[styles.aboutLabel, { color: theme.textSecondary }]}>
          {t('settings.updateStatus')}
        </Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          {appUpdate.checking && (
            <Text style={[styles.aboutValue, { color: theme.textSecondary }]}>
              {t('settings.checkingUpdate')}
            </Text>
          )}
          {appUpdate.hasUpdate && !appUpdate.downloading && (
            <Text style={[styles.aboutValue, { color: theme.primary }]}>
              v{appUpdate.latestVersion} {t('settings.updateAvailable')}
            </Text>
          )}
          {appUpdate.downloading && appUpdate.downloadProgress !== null && (
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.surfaceMuted, borderRadius: 2 },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.primary,
                      width: `${appUpdate.downloadProgress}%`,
                      borderRadius: 2,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                {appUpdate.downloadProgress}%
              </Text>
            </View>
          )}
          {!appUpdate.checking && !appUpdate.hasUpdate && !appUpdate.downloading && (
            <Text style={[styles.aboutValue, { color: theme.textSecondary }]}>
              {t('settings.upToDate')}
            </Text>
          )}
        </View>
      </View>
      {(appUpdate.hasUpdate || (!appUpdate.checking && !appUpdate.downloading)) && (
        <TouchableOpacity
          style={[
            styles.aboutActionBtn,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
          ]}
          onPress={appUpdate.hasUpdate ? appUpdate.downloadAndInstall : appUpdate.checkForUpdate}
          disabled={appUpdate.downloading}
        >
          <Text style={[styles.aboutActionText, { color: theme.primary }]}>
            {appUpdate.hasUpdate ? t('settings.installUpdate') : t('settings.checkUpdate')}
          </Text>
        </TouchableOpacity>
      )}
    </SettingsSection>
  )

  const handleLogout = async () => {
    await logout()
  }

  const renderStorageSection = () => (
    <SettingsSection
      icon={<Trash size={18} color={theme.text} />}
      title={t('settings.storage')}
      summary={
        (showStorageSettings ? t('settings.collapsed') : t('settings.expanded')) +
        ' · ' +
        t('settings.storageTotal', {
          size: isLoadingStorage ? '...' : formatBytes(totalStorageSize),
        })
      }
      expanded={showStorageSettings}
      onToggle={() => toggleSectionWithAnimation(setShowStorageSettings)}
      contentStyle={styles.storageSettings}
    >
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
            <Text style={{ fontSize: 14, color: theme.text, fontWeight: '500' }}>{item.label}</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
              {item.description}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
              {item.size > 0 ? formatBytes(item.size) : '—'}
              {item.itemCount != null && item.itemCount > 0
                ? ` · ${item.itemCount} ${t('settings.items')}`
                : ''}
            </Text>
          </View>
          {item.clearable && (
            <Button
              variant="ghost"
              size="small"
              onPress={() => handleClearStorage(item)}
              disabled={clearingId === item.id}
              title={clearingId === item.id ? t('settings.clearing') : t('settings.clear')}
            />
          )}
        </View>
      ))}
    </SettingsSection>
  )

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {renderAccountSection()}
        {renderGeneralSection()}
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
    paddingTop: 4,
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
    fontWeight: '600',
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 11,
    minWidth: 32,
  },
  updateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  updateBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  aboutLabel: {
    fontSize: 13,
  },
  aboutValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  aboutActionBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
})
