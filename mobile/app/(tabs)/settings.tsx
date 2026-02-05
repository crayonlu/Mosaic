import { Button, Input } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { getAIConfig, setAIConfig, type AIConfig } from '@/lib/ai'
import { resourcesApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import * as ImagePicker from 'expo-image-picker'
import { Info, LogOut, Moon, Sparkles, Sun, User } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useThemeStore()
  const { user, serverUrl, logout, refreshUser } = useAuthStore()
  const [aiConfig, setLocalAIConfig] = useState<AIConfig | null>(null)
  const [showAISettings, setShowAISettings] = useState(true)
  const [savingAI, setSavingAI] = useState(false)

  // Get full avatar URL
  const getAvatarUrl = () => {
    if (!user?.avatarUrl) return null
    // If avatarUrl is already a full URL (starts with http), return as is
    if (user.avatarUrl.startsWith('http')) return user.avatarUrl
    // Otherwise, prepend the server URL
    return serverUrl ? `${serverUrl}${user.avatarUrl}` : null
  }

  useEffect(() => {
    loadAIConfig()
  }, [])

  const loadAIConfig = async () => {
    const config = await getAIConfig()
    setLocalAIConfig(config)
  }

  const toggleTheme = () => {
    setThemeMode(themeMode === 'light' ? 'dark' : 'light')
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

  const handleAvatarPress = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      try {
        await resourcesApi.uploadAvatar({
          uri: asset.uri,
          name: asset.fileName || 'avatar.jpg',
          type: asset.mimeType || 'image/jpeg',
        })
        // Update local user state with new avatar URL
        await refreshUser()
        toast.show({
          type: 'success',
          title: '上传成功',
          message: '头像已更新',
        })
      } catch (error) {
        console.error('Upload avatar error:', error)
        toast.show({
          type: 'error',
          title: '上传失败',
          message: '上传头像时出错',
        })
      }
    }
  }

  const renderAccountSection = () => {
    const avatarUrl = getAvatarUrl()
    return (
      <View style={[styles.section, { marginBottom: 12 }]}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.row} onPress={handleAvatarPress}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              {avatarUrl ? (
                <Text style={styles.avatarText}>{user?.username?.charAt(0).toUpperCase()}</Text>
              ) : (
                <User size={20} color="#FFFFFF" />
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
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderAppearanceSection = () => (
    <View style={[styles.section, { marginBottom: 12 }]}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
          {themeMode === 'light' ? (
            <Sun size={18} color={theme.text} />
          ) : (
            <Moon size={18} color={theme.text} />
          )}
          <Text style={[styles.menuItemText, { color: theme.text }]}>
            {themeMode === 'light' ? '浅色模式' : '深色模式'}
          </Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>
              {themeMode === 'light' ? '使用浅色主题' : '使用深色主题'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderAISettings = () => (
    <View style={[styles.section, { marginBottom: 12 }]}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.menuItem, showAISettings && { borderBottomColor: theme.border }]}
          onPress={() => setShowAISettings(!showAISettings)}
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
          <View style={styles.aiSettings}>
            <View style={styles.settingRow}>
              <View style={styles.providerButtons}>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    aiConfig.provider === 'openai' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setLocalAIConfig({ ...aiConfig, provider: 'openai' })}
                >
                  <Text
                    style={[
                      styles.providerButtonText,
                      aiConfig.provider === 'openai' && { color: '#FFFFFF' },
                    ]}
                  >
                    OpenAI
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    aiConfig.provider === 'anthropic' && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setLocalAIConfig({ ...aiConfig, provider: 'anthropic' })}
                >
                  <Text
                    style={[
                      styles.providerButtonText,
                      { color: theme.text },
                      aiConfig.provider === 'anthropic' && { color: '#FFFFFF' },
                    ]}
                  >
                    Anthropic
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.settingRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>API URL</Text>
              <Input
                value={aiConfig.baseUrl}
                onChangeText={text => setLocalAIConfig({ ...aiConfig, baseUrl: text })}
                placeholder="https://api.openai.com/v1"
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>API Key</Text>
              <Input
                value={aiConfig.apiKey}
                onChangeText={text => setLocalAIConfig({ ...aiConfig, apiKey: text })}
                placeholder="sk-..."
                secureTextEntry
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>模型</Text>
              <Input
                value={aiConfig.model}
                onChangeText={text => setLocalAIConfig({ ...aiConfig, model: text })}
                placeholder={aiConfig.provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514'}
              />
            </View>
            <Button
              title="保存"
              variant="primary"
              onPress={handleSaveAIConfig}
              loading={savingAI}
            />
          </View>
        )}
      </View>
    </View>
  )

  const renderAboutSection = () => (
    <View style={[styles.section, { marginBottom: 12 }]}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity style={styles.menuItem}>
          <Info size={18} color={theme.text} />
          <Text style={[styles.menuItemText, { color: theme.text }]}>关于</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.menuItemSubText, { color: theme.textSecondary }]}>
              Mosaic v1.0.0
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )

  const handleLogout = async () => {
    await logout()
  }

  const renderLogoutSection = () => (
    <View style={[styles.section, { marginBottom: 24 }]}>
      <Button
        title="退出登录"
        variant="danger"
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
        fullWidth
        leftIcon={<LogOut size={18} color="#FFFFFF" />}
      />
    </View>
  )

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {renderAccountSection()}
        {renderAppearanceSection()}
        {renderAISettings()}
        {renderAboutSection()}
        {renderLogoutSection()}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  aiSettings: {
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingRow: {
    gap: 8,
  },
  providerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  providerButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  providerButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
})
