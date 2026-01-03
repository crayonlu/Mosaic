/**
 * Root Layout
 * Main entry point for the app
 */

import { useThemeStore } from '@/stores/theme-store'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { ToastContainer } from '@/components/ui/Toast'

export default function RootLayout() {
  const { theme } = useThemeStore()

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
