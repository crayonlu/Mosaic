import { type ReactNode, useEffect, useState } from 'react'
import { Keyboard, Platform, type StyleProp, View, type ViewStyle } from 'react-native'

interface KeyboardAvoidProviderProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  extraBottom?: number
  enabled?: boolean
}

export function KeyboardAvoidProvider({
  children,
  style,
  extraBottom = 0,
  enabled = true,
}: KeyboardAvoidProviderProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const avoidOffset = keyboardHeight > 0 ? keyboardHeight + extraBottom : 0
  const translateY = enabled ? -Math.max(avoidOffset, 0) : 0

  useEffect(() => {
    if (!enabled) {
      setKeyboardHeight(0)
      return
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSubscription = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0)
    })

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0)
    })

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [enabled])

  return (
    <View style={[style, { transform: [{ translateY }] }]}>
      {children}
    </View>
  )
}