import { useThemeStore } from '@/stores/themeStore'
import { Eye, EyeOff } from 'lucide-react-native'
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  showPasswordToggle?: boolean
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, showPasswordToggle, style, ...props },
  ref
) {
  const { theme } = useThemeStore()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const isFocusedRef = useRef(false)

  const setRef = useCallback(
    (node: TextInput | null) => {
      inputRef.current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref]
  )

  const lastShowTimeRef = useRef(0)

  useEffect(() => {
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (isFocusedRef.current) {
        const hideTime = Date.now()
        setTimeout(() => {
          // Only blur if keyboard didn't show again (secureTextEntry re-init, etc.)
          if (isFocusedRef.current && lastShowTimeRef.current < hideTime) {
            inputRef.current?.blur()
          }
        }, 200)
      }
    })

    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      lastShowTimeRef.current = Date.now()
    })

    return () => {
      hideSub.remove()
      showSub.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const borderColor = error ? theme.error : isFocused ? theme.primary : 'transparent'
  const borderWidth = error || isFocused ? 1 : 0
  const backgroundColor = isFocused ? theme.surface : theme.surfaceMuted

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor,
            borderColor,
            borderWidth,
            borderRadius: theme.radius.medium,
            paddingHorizontal: theme.spacing,
          },
        ]}
      >
        <TextInput
          ref={setRef}
          style={[
            styles.input,
            {
              color: theme.text,
              fontSize: theme.typography.bodyLarge.fontSize,
              flex: 1,
            },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={showPasswordToggle && !passwordVisible}
          onFocus={e => {
            setIsFocused(true)
            isFocusedRef.current = true
            props.onFocus?.(e)
          }}
          onBlur={e => {
            setIsFocused(false)
            isFocusedRef.current = false
            props.onBlur?.(e)
          }}
          {...props}
        />
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setPasswordVisible(!passwordVisible)}
          >
            {passwordVisible ? (
              <EyeOff size={20} color={theme.textSecondary} />
            ) : (
              <Eye size={20} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  input: {
    height: 48,
    flex: 1,
  },
  toggleButton: {
    padding: 8,
    marginLeft: 4,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
})
