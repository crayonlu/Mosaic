/**
 * Navigation Configuration
 * Defines navigation structure, routes, and paths
 */

export type RootParamList = {
  '(tabs)': undefined
  'memo/[id]': { id: string }
  modal: undefined
}

export type TabParamList = {
  index: undefined
  archive: undefined
  search: undefined
  settings: undefined
}

export type ModalParamList = {
  'input-editor': { memoId?: string }
  'voice': undefined
}

// Navigation type definitions for stack screen options
export type ScreenOptions = {
  headerShown?: boolean
  headerTitle?: string
  headerStyle?: any
  headerTintColor?: string
  animation?: 'default' | 'fade' | 'none'
  presentation?: 'card' | 'modal' | 'transparentModal'
  gestureEnabled?: boolean
}

// Tab navigation configuration
export const TabNavigatorConfig = {
  screenOptions: {
    headerShown: false,
    animation: 'fade' as const,
  },
} as const

// Modal navigation configuration
export const ModalNavigatorConfig = {
  screenOptions: {
    presentation: 'transparentModal' as const,
    animation: 'default' as const,
    headerShown: true,
    headerStyle: {
      backgroundColor: 'transparent',
      elevation: 0,
      shadowOpacity: 0,
    },
    contentStyle: {
      backgroundColor: 'transparent',
    },
  },
} as const

// Deep link configuration
export const DeepLinks = {
  memo: (id: string) => `mosaic://memo/${id}`,
  archive: () => `mosaic://archive`,
  search: (query?: string) => `mosaic://search${query ? `?q=${encodeURIComponent(query)}` : ''}`,
} as const

// Animation presets for Reanimated
export const NavigationAnimations = {
  slideUp: {
    from: { translateY: '100%' },
    to: { translateY: 0 },
  },
  slideDown: {
    from: { translateY: 0 },
    to: { translateY: '100%' },
  },
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  scale: {
    from: { scale: 0.9 },
    to: { scale: 1 },
  },
} as const
