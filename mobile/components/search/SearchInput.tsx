import { useThemeStore } from '@/stores/themeStore'
import { Search, X } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'

interface SearchInputProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  onSubmit?: () => void
  style?: object
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = '搜索内容或标签...',
  onSubmit,
  style,
}: SearchInputProps) {
  const { theme } = useThemeStore()
  const [isFocused, setIsFocused] = useState(false)

  const handleClear = () => {
    onChangeText('')
  }

  return (
    <View
      style={[
        styles.container,
        style,
        {
          backgroundColor: theme.surfaceMuted,
          borderColor: isFocused ? theme.border : 'transparent',
          borderWidth: isFocused ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      <Search size={20} color={theme.textSecondary} />
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        onSubmitEditing={onSubmit}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <X size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
})
