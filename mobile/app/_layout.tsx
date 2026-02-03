import { ToastContainer } from '@/components/ui'
import ThemeAwareSplash from '@/components/splash/ThemeAwareSplash'
import { QueryProvider } from '@/components/query-provider'
import { useConnectionStore } from '@/stores/connection-store'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore, useThemeInit } from '@/stores/theme-store'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StyleSheet, View, Text } from 'react-native'

export default function RootLayout() {
  const { theme } = useThemeStore()
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
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
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
              contentStyle: { backgroundColor: theme.background },
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
