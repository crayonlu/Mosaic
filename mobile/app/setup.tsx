import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import { CheckCircle, XCircle } from 'lucide-react-native'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'

export default function SetupScreen() {
  const { theme, themeMode } = useThemeStore()
  const { login, testConnection, isLoading } = useAuthStore()

  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleTestConnection = async () => {
    if (!serverUrl) return

    setConnectionStatus('testing')
    setErrorMessage('')

    try {
      const isConnected = await testConnection(serverUrl)
      if (isConnected) {
        setConnectionStatus('success')
      } else {
        setConnectionStatus('error')
        setErrorMessage('无法连接到服务器')
      }
    } catch {
      setConnectionStatus('error')
      setErrorMessage('连接测试失败')
    }
  }

  const handleLogin = async () => {
    if (!serverUrl || !username || !password) return

    setErrorMessage('')

    try {
      await login(serverUrl, username, password)
    } catch (error: any) {
      setErrorMessage(error?.error || '登录失败，请检查配置')
    }
  }

  const handleInputChange = () => {
    setConnectionStatus('idle')
    setErrorMessage('')
  }

  const isFormValid = serverUrl && username && password
  const canLogin = isFormValid && connectionStatus === 'success'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
                  <Text style={styles.errorText}>{errorMessage}</Text>
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
                    disabled={!serverUrl || !username || !password || isLoading}
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
    </SafeAreaView>
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
    borderRadius: 20,
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
    gap: 0,
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
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    flex: 1,
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
