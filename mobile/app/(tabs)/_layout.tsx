/**
 * Bottom Tab Navigation
 * Main app navigation with glassmorphism style
 */

import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useThemeStore } from '@/stores/theme-store'
import { Tabs as TabItems } from '@/constants/common'
import { Shadows, layout } from '@/constants/theme'
import { Platform } from 'react-native'

export default function TabLayout() {
  const { theme, isDark } = useThemeStore()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primaryDark,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: isDark
            ? theme.backgroundGlass
            : 'rgba(255, 255, 255, 0.9)',
          borderTopColor: theme.border,
          borderTopWidth: Platform.select({ ios: 0.5, android: 1 }),
          height: layout.tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? 8 : 0,
          paddingTop: 8,
          ...Shadows.lg,
          ...(Platform.OS === 'ios' && {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500' as const,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TabItems.items[0].label,
          tabBarIcon: ({ focused, color }) => <TabBarIcon name="book" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: TabItems.items[1].label,
          tabBarIcon: ({ focused, color }) => <TabBarIcon name="folder-open" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: TabItems.items[2].label,
          tabBarIcon: ({ focused, color }) => <TabBarIcon name="search" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: TabItems.items[3].label,
          tabBarIcon: ({ focused, color }) => <TabBarIcon name="settings" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  )
}

function TabBarIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  return <Ionicons size={28} name={name as any} color={color} />
}
