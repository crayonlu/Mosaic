import { useThemeStore } from '@/stores/theme-store'
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

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: error ? '#EF4444' : theme.border,
              flex: 1,
            },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={showPasswordToggle && !passwordVisible}
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
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  toggleButton: {
    padding: 12,
    position: 'absolute',
    right: 4,
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
})
