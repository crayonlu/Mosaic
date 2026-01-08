/**
 * Root Layout
 * Main entry point for the app
 */

import { Loading, ToastContainer } from '@/components/ui'
import { useDatabaseStore } from '@/lib/database/state-manager'
import { useThemeStore } from '@/stores/theme-store'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

export default function RootLayout() {
  const { theme } = useThemeStore()
  const { isInitializing: dbInitializing, initializeDatabase } = useDatabaseStore()

  // Initialize database on app start
  useEffect(() => {
    initializeDatabase()
  }, [])

  // Show loading screen while database is initializing
  if (dbInitializing) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <Loading text="初始化数据库..." fullScreen />
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
