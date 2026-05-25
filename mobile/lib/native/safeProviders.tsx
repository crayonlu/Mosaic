import { type ReactNode } from 'react'
import { ScrollView, View } from 'react-native'

// ─── Safe BootSplash ─────────────────────────────────────────────

type BootSplashModuleType = typeof import('react-native-bootsplash')

let bootSplashModule: BootSplashModuleType | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  bootSplashModule = require('react-native-bootsplash') as BootSplashModuleType
} catch {
  console.warn('[BootSplash] react-native-bootsplash not available in Expo Go, skip splash hiding.')
}

/** Safe wrapper that no-ops when react-native-bootsplash is unavailable. */
export function hideBootSplash({ fade }: { fade: boolean }) {
  if (!bootSplashModule) {
    return Promise.resolve()
  }
  return bootSplashModule.default.hide({ fade }).catch(() => {
    // Ignore hide races during startup.
  })
}

// ─── Safe KeyboardProvider ───────────────────────────────────────

type KeyboardControllerModuleType = typeof import('react-native-keyboard-controller')

let keyboardControllerModule: KeyboardControllerModuleType | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  keyboardControllerModule =
    require('react-native-keyboard-controller') as KeyboardControllerModuleType
} catch {
  console.warn(
    '[KeyboardController] react-native-keyboard-controller not available in Expo Go, keyboard features disabled.'
  )
}

export function SafeKeyboardProvider({ children }: { children: ReactNode }) {
  if (!keyboardControllerModule) {
    return <>{children}</>
  }
  return (
    <keyboardControllerModule.KeyboardProvider>
      {children}
    </keyboardControllerModule.KeyboardProvider>
  )
}

// ─── Safe KeyboardAvoidingView ───────────────────────────────────

export function SafeKeyboardAvoidingView({
  children,
  style,
  ...props
}: {
  children: ReactNode
  style?: object
  behavior?: 'height' | 'position' | 'padding'
  keyboardVerticalOffset?: number
}) {
  if (!keyboardControllerModule) {
    console.warn(
      '[KeyboardAvoidingView] react-native-keyboard-controller not available in Expo Go, using regular View.'
    )
    return <View style={style}>{children}</View>
  }
  const KAV = keyboardControllerModule.KeyboardAvoidingView
  return (
    <KAV style={style} {...props}>
      {children}
    </KAV>
  )
}

// ─── Safe ShareIntentProvider ────────────────────────────────────

type ShareIntentModuleType = typeof import('expo-share-intent')

let shareIntentModule: ShareIntentModuleType | undefined
let hasWarnedShareIntent = false

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  shareIntentModule = require('expo-share-intent') as ShareIntentModuleType
} catch {
  if (!hasWarnedShareIntent) {
    console.warn('[ShareIntent] expo-share-intent not available in Expo Go, share-to-app disabled.')
    hasWarnedShareIntent = true
  }
}

export function SafeShareIntentProvider({ children }: { children: ReactNode }) {
  if (!shareIntentModule) {
    return <>{children}</>
  }
  return <shareIntentModule.ShareIntentProvider>{children}</shareIntentModule.ShareIntentProvider>
}

/**
 * Safe hook for useShareIntentContext. Returns a no-op context when share-intent unavailable.
 */
export function useSafeShareIntent() {
  if (!shareIntentModule) {
    return {
      hasShareIntent: false,
      shareIntent: null,
      resetShareIntent: () => {},
    }
  }
  try {
    return shareIntentModule.useShareIntentContext()
  } catch {
    return {
      hasShareIntent: false,
      shareIntent: null,
      resetShareIntent: () => {},
    }
  }
}

// ─── Safe KeyboardStickyView ─────────────────────────────────────

export function SafeKeyboardStickyView({
  children,
  style,
  ...props
}: {
  children: ReactNode
  style?: object
  offset?: { closed: number; opened: number }
}) {
  if (!keyboardControllerModule) {
    return <View style={style}>{children}</View>
  }
  const KSV = keyboardControllerModule.KeyboardStickyView
  return (
    <KSV style={style} {...props}>
      {children}
    </KSV>
  )
}

// ─── Safe KeyboardAwareScrollView ────────────────────────────────

type KeyboardAwareScrollViewProps = {
  children: ReactNode
  style?: object
  contentContainerStyle?: object
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled'
  bottomOffset?: number
  ref?: React.Ref<any>
}

export function SafeKeyboardAwareScrollView({
  children,
  style,
  ...props
}: KeyboardAwareScrollViewProps) {
  if (!keyboardControllerModule) {
    return (
      <ScrollView style={style} {...(props as any)}>
        {children}
      </ScrollView>
    )
  }
  const KASV = keyboardControllerModule.KeyboardAwareScrollView
  return (
    <KASV style={style} {...(props as any)}>
      {children}
    </KASV>
  )
}
