import { QueryProvider } from '@/components/query-provider'
import ThemeAwareSplash from '@/components/splash/ThemeAwareSplash'
import { ToastContainer } from '@/components/ui'
import { getMoodColorWithIntensity } from '@/lib/utils/mood'
import { useAuthStore } from '@/stores/auth-store'
import { useConnectionStore } from '@/stores/connection-store'
import { useMoodStore } from '@/stores/mood-store'
import { useThemeInit, useThemeStore } from '@/stores/theme-store'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

export default function RootLayout() {
  const { theme } = useThemeStore()
  const { currentMood, currentMoodIntensity } = useMoodStore()
  const { isServerReachable, initialize } = useConnectionStore()
  const { isAuthenticated, isInitialized, isLoading, initialize: initAuth } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useThemeInit()

  useEffect(() => {
    initAuth()
    initialize()
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

  if (!isInitialized || isLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <ThemeAwareSplash />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: isDiariesTab ? 'transparent' : theme.background,
          }}
        >
          {isDiariesTab && (
            <LinearGradient
              colors={[moodColor, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          )}
          <StatusBar style="auto" />
          <QueryProvider>
            {isAuthenticated && !isServerReachable && (
              <View style={[styles.offlineBanner, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.offlineText}>无法连接到服务器</Text>
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
            <ToastContainer />
          </QueryProvider>
        </SafeAreaView>
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
})
