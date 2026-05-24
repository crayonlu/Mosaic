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
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'

export default function SetupScreen() {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
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
      setErrorHint(t('setup.urlHint'))
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
        throw {
          status: response.status,
          error: t('setup.healthCheckFailed', { status: response.status }),
        }
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
      setErrorHint(t('setup.fixUrlFirst'))
      return
    }

    if (connectionStatus !== 'success') {
      setConnectionStatus('error')
      setErrorMessage(t('setup.testConnectionFirst'))
      setErrorHint(t('setup.testConnectionHint'))
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

  const LOGO_SECTION_HEIGHT = 140
  const logoOpacity = useSharedValue(1)
  const logoHeight = useSharedValue(LOGO_SECTION_HEIGHT)

  useKeyboardHandler({
    onStart: e => {
      'worklet'
      const isOpening = e.height > 0
      logoOpacity.value = withTiming(isOpening ? 0 : 1, { duration: isOpening ? 150 : 200 })
      logoHeight.value = withTiming(isOpening ? 0 : LOGO_SECTION_HEIGHT, {
        duration: isOpening ? 150 : 200,
      })
    },
  })

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    height: logoHeight.value,
    overflow: 'hidden' as const,
  }))

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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.header, logoAnimatedStyle]}>
            <Image
              source={require('@/assets/images/mosaic-light.svg')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('setup.subtitle')}
            </Text>
          </Animated.View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{t('setup.serverConfig')}</Text>
            <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
              {t('setup.serverConfigDesc')}
            </Text>

            <View style={styles.form}>
              <Input
                label={t('setup.serverUrl')}
                placeholder={t('setup.serverUrlPlaceholder')}
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
                label={t('setup.username')}
                placeholder={t('setup.usernamePlaceholder')}
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
                label={t('setup.password')}
                placeholder={t('setup.passwordPlaceholder')}
                value={password}
                onChangeText={text => {
                  setPassword(text)
                  handleInputChange()
                }}
                showPasswordToggle
                editable={!isLoading}
              />

              {connectionStatus === 'error' && (
                <View
                  style={[
                    styles.errorContainer,
                    {
                      backgroundColor: theme.semantic.errorSoft,
                      borderColor: theme.border,
                      borderRadius: theme.radius.medium,
                    },
                  ]}
                >
                  <XCircle size={16} color={theme.error} />
                  <View style={styles.errorTextWrapper}>
                    <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
                    {errorHint ? (
                      <Text style={[styles.errorHint, { color: theme.textSecondary }]}>
                        {errorHint}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              <View style={styles.buttonRow}>
                <View style={styles.buttonWrapper}>
                  <Button
                    title={
                      connectionStatus === 'testing'
                        ? t('setup.testing')
                        : connectionStatus === 'success'
                          ? t('setup.connectionOk')
                          : t('setup.testConnection')
                    }
                    onPress={handleTestConnection}
                    variant="secondary"
                    disabled={!serverUrl || isLoading}
                    loading={connectionStatus === 'testing'}
                    fullWidth
                  />
                  {connectionStatus === 'success' && (
                    <View style={styles.successIcon}>
                      <CheckCircle size={20} color={theme.success} />
                    </View>
                  )}
                </View>

                <View style={styles.buttonWrapper}>
                  <Button
                    title={t('setup.start')}
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
    borderRadius: 16,
    padding: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '500',
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
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    gap: 8,
  },
  errorTextWrapper: {
    flex: 1,
    gap: 4,
  },
  errorText: {
    fontSize: 14,
  },
  errorHint: {
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
