import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  mapServerConnectionError,
  normalizeServerUrlInput,
  validateServerUrl,
} from '@/lib/errors/serverConnection'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Image } from 'expo-image'
import { CheckCircle, XCircle } from 'lucide-react-native'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'

export default function SetupScreen() {
  const { theme, themeMode } = useThemeStore()
  const insets = useSafeAreaInsets()
  const { login, isLoading } = useAuthStore()

  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [errorHint, setErrorHint] = useState('')

  const handleTestConnection = async () => {
    const normalizedServerUrl = normalizeServerUrlInput(serverUrl)
    const urlError = validateServerUrl(normalizedServerUrl)
    if (urlError) {
      setConnectionStatus('error')
      setErrorMessage(urlError)
      setErrorHint('请使用完整地址，例如 https://your-server.com')
      return
    }

    setConnectionStatus('testing')
    setErrorMessage('')
    setErrorHint('')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch(`${normalizedServerUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw { status: response.status, error: `Health check failed: HTTP ${response.status}` }
      }

      setConnectionStatus('success')
    } catch (error: unknown) {
      const presentation = mapServerConnectionError(error, 'connect')
      setConnectionStatus('error')
      setErrorMessage(presentation.message)
      setErrorHint(presentation.hint || '')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const handleLogin = async () => {
    if (!serverUrl || !username || !password) return

    const normalizedServerUrl = normalizeServerUrlInput(serverUrl)
    const urlError = validateServerUrl(normalizedServerUrl)
    if (urlError) {
      setConnectionStatus('error')
      setErrorMessage(urlError)
      setErrorHint('请先修正服务器地址，再继续登录。')
      return
    }

    if (connectionStatus !== 'success') {
      setConnectionStatus('error')
      setErrorMessage('请先完成服务器连接测试')
      setErrorHint('点击“测试连接”，显示连接成功后再登录。')
      return
    }

    setErrorMessage('')
    setErrorHint('')

    try {
      await login(normalizedServerUrl, username, password)
    } catch (error: unknown) {
      const presentation = mapServerConnectionError(error, 'login')
      setConnectionStatus('error')
      setErrorMessage(presentation.message)
      setErrorHint(presentation.hint || '')
    }
  }

  const handleInputChange = () => {
    setConnectionStatus('idle')
    setErrorMessage('')
    setErrorHint('')
  }

  const isFormValid = serverUrl && username && password
  const canLogin = isFormValid && connectionStatus === 'success'

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image
              source={
                themeMode === 'dark'
                  ? require('@/assets/images/mosaic-dark.svg')
                  : require('@/assets/images/mosaic-light.svg')
              }
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              完成初始化配置，开始您的智能笔记之旅
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>服务器配置</Text>
            <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
              输入您的 Mosaic 服务器信息
            </Text>

            <View style={styles.form}>
              <Input
                label="服务器地址"
                placeholder="https://your-server.com"
                value={serverUrl}
                onChangeText={text => {
                  setServerUrl(text)
                  handleInputChange()
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isLoading}
              />

              <Input
                label="用户名"
                placeholder="your-username"
                value={username}
                onChangeText={text => {
                  setUsername(text)
                  handleInputChange()
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />

              <Input
                label="密码"
                placeholder="••••••••"
                value={password}
                onChangeText={text => {
                  setPassword(text)
                  handleInputChange()
                }}
                showPasswordToggle
                editable={!isLoading}
              />

              {connectionStatus === 'error' && (
                <View style={styles.errorContainer}>
                  <XCircle size={16} color="#EF4444" />
                  <View style={styles.errorTextWrapper}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    {errorHint ? <Text style={styles.errorHint}>{errorHint}</Text> : null}
                  </View>
                </View>
              )}

              <View style={styles.buttonRow}>
                <View style={styles.buttonWrapper}>
                  <Button
                    title={
                      connectionStatus === 'testing'
                        ? '测试中...'
                        : connectionStatus === 'success'
                          ? '连接成功'
                          : '测试连接'
                    }
                    onPress={handleTestConnection}
                    variant="secondary"
                    disabled={!serverUrl || isLoading}
                    loading={connectionStatus === 'testing'}
                    fullWidth
                  />
                  {connectionStatus === 'success' && (
                    <View style={styles.successIcon}>
                      <CheckCircle size={20} color="#22C55E" />
                    </View>
                  )}
                </View>

                <View style={styles.buttonWrapper}>
                  <Button
                    title="开始使用"
                    onPress={handleLogin}
                    disabled={!canLogin || isLoading}
                    loading={isLoading}
                    fullWidth
                  />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 180,
    height: 100,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    borderRadius: 8,
    padding: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 24,
  },
  form: {
    gap: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorTextWrapper: {
    flex: 1,
    gap: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  errorHint: {
    color: '#B91C1C',
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  buttonWrapper: {
    flex: 1,
    position: 'relative',
  },
  successIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
})
