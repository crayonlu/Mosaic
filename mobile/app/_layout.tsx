import { QueryProvider } from '@/components/QueryProvider'
import ThemeAwareSplash from '@/components/splash/ThemeAwareSplash'
import { ToastContainer } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { useCacheStore } from '@/stores/cacheStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useMoodStore } from '@/stores/moodStore'
import { useThemeInit, useThemeStore } from '@/stores/themeStore'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { getMoodColorWithIntensity } from '@mosaic/utils'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore repeated calls while the root layout mounts.
})

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

export default function RootLayout() {
  const { theme } = useThemeStore()
  const { currentMood, currentMoodIntensity } = useMoodStore()
  const { isServerReachable, initialize, lastError } = useConnectionStore()
  const { isAuthenticated, isInitialized, isLoading, initialize: initAuth } = useAuthStore()
  const { setReady: setCacheReady } = useCacheStore()
  const segments = useSegments()
  const router = useRouter()
  const hasHiddenNativeSplash = useRef(false)

  useThemeInit()

  const hideNativeSplash = useCallback(() => {
    if (hasHiddenNativeSplash.current) return
    hasHiddenNativeSplash.current = true
    SplashScreen.hideAsync().catch(() => {
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
          }
        } catch (error) {
          console.warn('Push registration failed:', error)
        }
      }
    }

    bootstrap()
  }, [])

  useEffect(() => {
    const initCache = async () => {
      const checkAuth = () => useAuthStore.getState().isInitialized
      const maxWait = 10000
      const startTime = Date.now()

      while (!checkAuth() && Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const authState = useAuthStore.getState()
      if (!authState.isAuthenticated) {
        setCacheReady(true)
        return
      }

      try {
        const { initializeMobileCache } = await import('../lib/cache')
        await initializeMobileCache()
        setCacheReady(true)
      } catch (error) {
        console.warn('Mobile cache initialization failed:', error)
        setCacheReady(true)
      }
    }

    initCache()
  }, [setCacheReady])

  useEffect(() => {
    const timeoutId = setTimeout(hideNativeSplash, 80)
    return () => clearTimeout(timeoutId)
  }, [hideNativeSplash])

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
  const [baseMoodColor, setBaseMoodColor] = useState(moodColor)
  const [overlayMoodColor, setOverlayMoodColor] = useState(moodColor)
  const overlayOpacity = useSharedValue(0)

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))

  const completeGradientTransition = useCallback(
    (nextColor: string) => {
      setBaseMoodColor(nextColor)
      overlayOpacity.value = 0
    },
    [overlayOpacity]
  )

  useEffect(() => {
    if (moodColor === baseMoodColor) return

    setOverlayMoodColor(moodColor)
    overlayOpacity.value = 0
    overlayOpacity.value = withTiming(1, { duration: 200 }, finished => {
      if (finished) {
        runOnJS(completeGradientTransition)(moodColor)
      }
    })
  }, [baseMoodColor, completeGradientTransition, moodColor, overlayOpacity])

  const isAppReady = isInitialized && !isLoading

  useEffect(() => {
    if (isAppReady) {
      hideNativeSplash()
    }
  }, [hideNativeSplash, isAppReady])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: theme.background }} onLayout={hideNativeSplash}>
          <SafeAreaContainer backgroundColor={isDiariesTab ? 'transparent' : theme.background}>
            {isDiariesTab && (
              <>
                <LinearGradient
                  colors={[baseMoodColor, 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, overlayStyle]}>
                  <LinearGradient
                    colors={[overlayMoodColor, 'transparent']}
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
                  <View style={[styles.offlineBanner, { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.offlineText}>{lastError || '无法连接到服务器'}</Text>
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
                </Stack>
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.noiseOverlay]}>
                  <Image
                    source={require('../assets/images/noise.png')}
                    contentFit="cover"
                    style={[styles.noiseImage, { opacity: 0.6 }]}
                  />
                </View>
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
    color: '#FFFFFF',
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
