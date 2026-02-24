/**
 * Bottom Tab Navigation
 * Main app navigation with clean glassmorphism style
 */

import { Tabs as TabItems } from '@/constants/common'
import { useThemeStore } from '@/stores/theme-store'
import { diariesApi } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Tabs } from 'expo-router'
import { Book, Calendar, Files, Search, Settings } from 'lucide-react-native'
import { useEffect } from 'react'

export default function TabLayout() {
  const { theme } = useThemeStore()
  const queryClient = useQueryClient()
  const inactiveTabColor = `${theme.primary}90`

  useEffect(() => {
    const today = dayjs().format('YYYY-MM-DD')

    queryClient.prefetchQuery({
      queryKey: ['diary', today],
      queryFn: () => diariesApi.get(today),
      staleTime: 5 * 60 * 1000,
    })
  }, [queryClient])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: inactiveTabColor,
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
          lazy: false,
          sceneStyle: {
            backgroundColor: 'transparent',
          },
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
    </Tabs>
  )
}
