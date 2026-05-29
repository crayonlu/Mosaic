import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MoodBackground } from '@/components/layout/MoodBackground'
import { QueryProvider } from '@/components/QueryProvider'
import ThemeAwareSplash from '@/components/splash/ThemeAwareSplash'
import { ToastContainer } from '@/components/ui'
import { preloadAuthHeaders } from '@/hooks/useAuthHeaders'
import i18n from '@/lib/i18n'
import {
  hideBootSplash,
  SafeKeyboardProvider,
  SafeShareIntentProvider,
  useSafeShareIntent,
} from '@/lib/native/safeProviders'
import { useAuthStore } from '@/stores/authStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useThemeStore } from '@/stores/themeStore'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

function SafeAreaContainer({
  children,
  backgroundColor,
}: {
  children: ReactNode
  backgroundColor: string
}) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        flex: 1,
        backgroundColor,
        paddingTop: insets.top,
        paddingRight: insets.right,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
      }}
    >
      {children}
    </View>
  )
}

function ShareIntentHandler({ children }: { children: ReactNode }) {
  const { hasShareIntent, resetShareIntent } = useSafeShareIntent()
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (hasShareIntent && !handled.current) {
      handled.current = true
      router.push('/share')
    }
    if (!hasShareIntent) {
      handled.current = false
    }
  }, [hasShareIntent, router, resetShareIntent])

  return <>{children}</>
}

export default function RootLayout() {
  const { t, i18n: i18nInstance } = useTranslation()
  const [langRevision, setLangRevision] = useState(0)
  const theme = useThemeStore(s => s.theme)
  const themeName = useThemeStore(s => s.themeName)
  const isServerReachable = useConnectionStore(s => s.isServerReachable)
  const lastError = useConnectionStore(s => s.lastError)
  const initialize = useConnectionStore(s => s.initialize)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const isInitialized = useAuthStore(s => s.isInitialized)
  const isLoading = useAuthStore(s => s.isLoading)
  const initAuth = useAuthStore(s => s.initialize)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    const handler = () => setLangRevision(v => v + 1)
    i18nInstance.on('languageChanged', handler)
    return () => {
      i18nInstance.off('languageChanged', handler)
    }
  }, [i18nInstance])

  const hideNativeSplash = useCallback(() => {
    hideBootSplash({ fade: true })
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initAuth()
        // Pre-warm auth headers AFTER auth init so tokens are available
        preloadAuthHeaders()
      } catch (error) {
        console.warn('Auth initialization failed:', error)
      }

      const authState = useAuthStore.getState()
      const shouldInitAppServices = authState.isAuthenticated && !!authState.serverUrl

      if (shouldInitAppServices) {
        try {
          await initialize()
        } catch (error) {
          console.warn('Connection initialization failed:', error)
        }

        try {
          if (useConnectionStore.getState().isServerReachable) {
            const { LocalPushService } = await import('../lib/services/local-push')
            const localPushService = LocalPushService.getInstance()
            await localPushService.registerAll()

            const { getSyncEngine } = await import('@/lib/sync/engine')
            getSyncEngine().sync()
          }
        } catch (error) {
          console.warn('Push registration failed:', error)
        }
      }
    }

    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isInitialized) return

    const inSetup = (segments[0] as string) === 'setup'
    const inThemePicker = (segments[0] as string) === 'theme-picker'

    if (!isAuthenticated && !inSetup && !inThemePicker) {
      router.replace('/theme-picker')
    } else if (isAuthenticated && (inSetup || inThemePicker)) {
      router.replace('/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isInitialized, segments])

  const isDiariesTab = segments[0] === '(tabs)' && segments[1] === 'diaries'

  const isAppReady = isInitialized && !isLoading

  useEffect(() => {
    if (isAppReady) {
      const id = setTimeout(() => hideNativeSplash(), 100)
      return () => clearTimeout(id)
    }
  }, [hideNativeSplash, isAppReady])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeShareIntentProvider>
          <ShareIntentHandler>
            <SafeKeyboardProvider>
              <SafeAreaProvider>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                  <SafeAreaContainer
                    backgroundColor={isDiariesTab ? 'transparent' : theme.background}
                  >
                    <MoodBackground />
                    <StatusBar style="auto" />
                    <BottomSheetModalProvider>
                      <I18nextProvider i18n={i18n}>
                        <QueryProvider>
                          {isAuthenticated && !isServerReachable && (
                            <View style={[styles.offlineBanner, { backgroundColor: theme.error }]}>
                              <Text style={[styles.offlineText, { color: theme.onPrimary }]}>
                                {lastError || t('offline.cannotConnect')}
                              </Text>
                            </View>
                          )}
                          <Stack
                            screenOptions={{
                              headerShown: false,
                              contentStyle: {
                                backgroundColor: isDiariesTab ? 'transparent' : theme.background,
                              },
                            }}
                          >
                            <Stack.Screen name="theme-picker" options={{ headerShown: false }} />
                            <Stack.Screen name="setup" options={{ headerShown: false }} />
                            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                            <Stack.Screen
                              name="bot-editor"
                              options={{
                                animation: 'slide_from_bottom',
                                headerShown: false,
                              }}
                            />
                            <Stack.Screen
                              name="share"
                              options={{
                                presentation: 'modal',
                                animation: 'slide_from_bottom',
                                headerShown: false,
                              }}
                            />
                          </Stack>
                          {themeName !== 'cleanSlate' &&
                            (segments[0] as string) !== 'theme-picker' && (
                              <View
                                pointerEvents="none"
                                style={[StyleSheet.absoluteFill, styles.noiseOverlay]}
                              >
                                <Image
                                  source={require('../assets/images/noise.png')}
                                  contentFit="cover"
                                  style={[styles.noiseImage, { opacity: 0.6 }]}
                                />
                              </View>
                            )}
                          <ToastContainer />
                          {!isAppReady && (
                            <View style={styles.splashOverlay}>
                              <ThemeAwareSplash />
                            </View>
                          )}
                        </QueryProvider>
                      </I18nextProvider>
                    </BottomSheetModalProvider>
                  </SafeAreaContainer>
                </View>
              </SafeAreaProvider>
            </SafeKeyboardProvider>
          </ShareIntentHandler>
        </SafeShareIntentProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  offlineBanner: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '500',
  },
  noiseOverlay: {
    zIndex: 5,
  },
  noiseImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
})
