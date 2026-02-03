import { Button, Input } from '@/components/ui'
import { resourcesApi } from '@/lib/api'
import { getAIConfig, setAIConfig, type AIConfig } from '@/lib/ai'
import { useAuthStore } from '@/stores/auth-store'
import { useConnectionStore } from '@/stores/connection-store'
import { useThemeStore } from '@/stores/theme-store'
import { Moon, Sun, User } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useThemeStore()
  const { user, serverUrl, logout } = useAuthStore()
  const { isConnected } = useConnectionStore()
  const [aiConfig, setLocalAIConfig] = useState<AIConfig | null>(null)
  const [showAISettings, setShowAISettings] = useState(false)
  const [savingAI, setSavingAI] = useState(false)

  useEffect(() => {
    loadAIConfig()
  }, [])

  const loadAIConfig = async () => {
    const config = await getAIConfig()
    setLocalAIConfig(config)
  }

  const handleLogout = async () => {
    await logout()
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
    } catch (error) {
      console.error('Save AI config error:', error)
    } finally {
      setSavingAI(false)
    }
  }

  const handleAvatarPress = async () => {
    if (!isConnected) return
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
      } catch (error) {
        console.error('Upload avatar error:', error)
      }
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={[styles.section, { marginBottom: 12 }]}>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.row} onPress={handleAvatarPress} disabled={!isConnected}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                {user?.avatar ? (
                  <Text style={styles.avatarText}>{user.username?.charAt(0).toUpperCase()}</Text>
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

        <View style={[styles.section, { marginBottom: 12 }]}>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.menuItem, showAISettings && { borderBottomColor: theme.border }]}
              onPress={() => setShowAISettings(!showAISettings)}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>AI 配置</Text>
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
                          aiConfig.provider === 'anthropic' && { color: '#FFFFFF' },
                        ]}
                      >
                        Anthropic
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Input
                  value={aiConfig.apiKey}
                  onChangeText={text => setLocalAIConfig({ ...aiConfig, apiKey: text })}
                  placeholder="sk-..."
                  secureTextEntry
                />
                <Input
                  value={aiConfig.model}
                  onChangeText={text => setLocalAIConfig({ ...aiConfig, model: text })}
                  placeholder={aiConfig.provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514'}
                />
                <Button
                  title="保存"
                  variant="primary"
                  onPress={handleSaveAIConfig}
                  loading={savingAI}
                  disabled={!isConnected}
                />
              </View>
            )}
          </View>
        </View>

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
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { marginBottom: 24 }]}>
          <Button title="退出登录" variant="danger" onPress={handleLogout} fullWidth />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.version, { color: theme.textSecondary }]}>Mosaic v1.0.0</Text>
        </View>
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
    padding: 12,
    gap: 10,
  },
  menuItemText: {
    fontSize: 14,
  },
  aiSettings: {
    padding: 12,
    gap: 10,
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
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  providerButtonText: {
    fontSize: 13,
  },
  footer: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  version: {
    fontSize: 11,
  },
})
