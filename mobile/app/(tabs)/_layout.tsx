/**
 * Bottom Tab Navigation
 * Main app navigation with clean glassmorphism style
 */

import { Tabs as TabItems } from '@/constants/common'
import { useThemeStore } from '@/stores/theme-store'
import { Tabs } from 'expo-router'
import { Book, Calendar, Files, Search, Settings, TestTubes } from 'lucide-react-native'

export default function TabLayout() {
  const { theme } = useThemeStore()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          height: 54,
          paddingBottom: 2,
          paddingTop: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        sceneStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TabItems.items[0].label,
          tabBarIcon: ({ focused, color }) => (
            <Book size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: TabItems.items[1].label,
          tabBarIcon: ({ focused, color }) => (
            <Files size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="diaries"
        options={{
          title: TabItems.items[2].label,
          tabBarIcon: ({ focused, color }) => (
            <Calendar size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: TabItems.items[3].label,
          tabBarIcon: ({ focused, color }) => (
            <Search size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: TabItems.items[4].label,
          tabBarIcon: ({ focused, color }) => (
            <Settings size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Protected guard={__DEV__}>
        <Tabs.Screen
          name="dev"
          options={{
            title: '开发工具',
            tabBarIcon: ({ focused, color }) => (
              <TestTubes size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
      </Tabs.Protected>
    </Tabs>
  )
}
