import { Loading, ToastContainer } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

export default function RootLayout() {
  const { theme } = useThemeStore()
  const { isAuthenticated, isInitialized, isLoading, initialize } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
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
          <Loading text="加载中..." fullScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style="auto" />
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
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
