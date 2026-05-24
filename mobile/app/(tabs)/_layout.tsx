/**
 * Bottom Tab Navigation
 * Main app navigation with clean glassmorphism style
 */

import { useThemeStore } from '@/stores/themeStore'
import { diariesApi } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Tabs } from 'expo-router'
import { Book, Calendar, Files, Search, Settings } from 'lucide-react-native'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const TabIconWithDot = React.memo(function TabIconWithDot({
  focused,
  children,
}: {
  focused: boolean
  children: React.ReactNode
}) {
  const theme = useThemeStore(s => s.theme)
  const dotOpacity = useSharedValue(focused ? 1 : 0)
  const dotScale = useSharedValue(focused ? 1 : 0.4)

  useEffect(() => {
    dotOpacity.value = withTiming(focused ? 1 : 0, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    })
    dotScale.value = withTiming(focused ? 1 : 0.4, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    })
  }, [focused, dotOpacity, dotScale])

  const dotAnimStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }))

  return (
    <View style={tabIconStyles.container}>
      {children}
      <Animated.View
        style={[tabIconStyles.dot, { backgroundColor: theme.primary }, dotAnimStyle]}
      />
    </View>
  )
})

const tabIconStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
})

export default function TabLayout() {
  const { t } = useTranslation()
  const theme = useThemeStore(s => s.theme)
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
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          height: 54,
          paddingBottom: 2,
          paddingTop: 2,
          ...theme.shadows.subtle,
          shadowOffset: { width: 0, height: -1 },
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
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
          title: t('tabs.home'),
          tabBarIcon: ({ focused, color }) => (
            <TabIconWithDot focused={focused}>
              <Book size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIconWithDot>
          ),
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: t('tabs.archive'),
          tabBarIcon: ({ focused, color }) => (
            <TabIconWithDot focused={focused}>
              <Files size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIconWithDot>
          ),
        }}
      />
      <Tabs.Screen
        name="diaries"
        options={{
          title: t('tabs.diaries'),
          sceneStyle: {
            backgroundColor: 'transparent',
          },
          tabBarIcon: ({ focused, color }) => (
            <TabIconWithDot focused={focused}>
              <Calendar size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIconWithDot>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ focused, color }) => (
            <TabIconWithDot focused={focused}>
              <Search size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIconWithDot>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ focused, color }) => (
            <TabIconWithDot focused={focused}>
              <Settings size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </TabIconWithDot>
          ),
        }}
      />
    </Tabs>
  )
}
