import { QueryProvider } from '@/components/QueryProvider'
import ThemeAwareSplash from '@/components/splash/ThemeAwareSplash'
import { ToastContainer } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useMoodStore } from '@/stores/moodStore'
import { useThemeInit, useThemeStore } from '@/stores/themeStore'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { getMoodColorWithIntensity } from '@mosaic/utils'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useSegments } from 'expo-router'
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent'
import { StatusBar } from 'expo-status-bar'
import { type ReactNode, useCallback, useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import BootSplash from 'react-native-bootsplash'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
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
  const { hasShareIntent, resetShareIntent } = useShareIntentContext()
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
  const { theme, themeName } = useThemeStore()
  const { currentMood, currentMoodIntensity } = useMoodStore()
  const { isServerReachable, initialize, lastError } = useConnectionStore()
  const { isAuthenticated, isInitialized, isLoading, initialize: initAuth } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useThemeInit()

  const hideNativeSplash = useCallback(() => {
    BootSplash.hide({ fade: false }).catch(() => {
      // Ignore hide races during startup.
    })
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initAuth()
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

    if (!isAuthenticated && !inSetup) {
      router.replace('/setup')
    } else if (isAuthenticated && inSetup) {
      router.replace('/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isInitialized, segments])

  const isDiariesTab = segments[0] === '(tabs)' && segments[1] === 'diaries'

  const moodColor = getMoodColorWithIntensity(currentMood, currentMoodIntensity)

  // Animate the mood color directly on the UI thread via interpolateColor.
  // fromColor = last stable color (or previous target on interrupt)
  // toColor   = next color to transition toward
  // progress  = 0→1 drives the interpolation
  const fromColor = useSharedValue(moodColor)
  const toColor = useSharedValue(moodColor)
  const progress = useSharedValue(1)

  useEffect(() => {
    if (moodColor === toColor.value) return
    cancelAnimation(progress)
    fromColor.value = toColor.value // start from previous target
    toColor.value = moodColor
    progress.value = 0
    progress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodColor])

  // Runs on UI thread — true RGB lerp at 60fps, no JS bridge
  const moodBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [fromColor.value, toColor.value]),
  }))

  const isAppReady = isInitialized && !isLoading

  useEffect(() => {
    if (isAppReady) {
      const id = setTimeout(() => hideNativeSplash(), 100)
      return () => clearTimeout(id)
    }
  }, [hideNativeSplash, isAppReady])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ShareIntentProvider>
        <ShareIntentHandler>
          <KeyboardProvider>
            <SafeAreaProvider>
              <View style={{ flex: 1, backgroundColor: theme.background }}>
                {!isAppReady && <ThemeAwareSplash />}
                <SafeAreaContainer
                  backgroundColor={isDiariesTab ? 'transparent' : theme.background}
                >
                  {isDiariesTab && (
                    <>
                      {/* Animated.View drives the mood color on UI thread via interpolateColor.
                      Inner LinearGradient fades it to transparent downward — no animated props needed. */}
                      <Animated.View
                        pointerEvents="none"
                        style={[StyleSheet.absoluteFill, moodBgStyle]}
                      >
                        <LinearGradient
                          colors={['transparent', theme.background]}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                        />
                      </Animated.View>
                    </>
                  )}
                  <StatusBar style="auto" />
                  <BottomSheetModalProvider>
                    <QueryProvider>
                      {isAuthenticated && !isServerReachable && (
                        <View style={[styles.offlineBanner, { backgroundColor: theme.error }]}>
                          <Text style={[styles.offlineText, { color: theme.onPrimary }]}>
                            {lastError || '无法连接到服务器'}
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
                        <Stack.Screen name="setup" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen
                          name="modal"
                          options={{
                            presentation: 'modal',
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
                      {themeName !== 'cleanSlate' && (
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
                  </BottomSheetModalProvider>
                </SafeAreaContainer>
              </View>
            </SafeAreaProvider>
          </KeyboardProvider>
        </ShareIntentHandler>
      </ShareIntentProvider>
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
