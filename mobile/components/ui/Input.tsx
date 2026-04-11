import { useThemeStore } from '@/stores/themeStore'
import { Eye, EyeOff } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  showPasswordToggle?: boolean
}

export function Input({ label, error, showPasswordToggle, style, ...props }: InputProps) {
  const { theme } = useThemeStore()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const borderColor = error ? theme.error : isFocused ? theme.primary : 'transparent'
  const borderWidth = error || isFocused ? 1 : 0
  const backgroundColor = isFocused ? theme.surface : theme.surfaceMuted

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor,
              color: theme.text,
              borderColor,
              borderWidth,
              borderRadius: theme.radius.medium,
              paddingHorizontal: theme.spacing,
              fontSize: theme.typography.bodyLarge,
              flex: 1,
            },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={showPasswordToggle && !passwordVisible}
          onFocus={e => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={e => {
            setIsFocused(false)
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
}

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
    width: '100%',
    minWidth: '100%',
  },
  toggleButton: {
    padding: 12,
    position: 'absolute',
    right: 4,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
})
