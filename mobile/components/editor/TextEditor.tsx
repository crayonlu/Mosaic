import { useThemeStore } from '@/stores/theme-store'
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

interface TextEditorProps {
  value: string
  onChange: (text: string) => void
  placeholder?: string
  editable?: boolean
}

export function TextEditor({
  value,
  onChange,
  placeholder = 'What\'s on your mind?',
  editable = true,
}: TextEditorProps) {
  const { theme } = useThemeStore()
  const [isFocused, setIsFocused] = useState(false)

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.background,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline
        editable={editable}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        textAlignVertical="top"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    padding: 12,
    minHeight: 120,
  },
})

