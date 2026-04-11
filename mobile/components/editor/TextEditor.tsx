import { useThemeStore } from '@/stores/themeStore'
import { StyleSheet, TextInput, View } from 'react-native'

interface TextEditorProps {
  value: string
  onChange: (text: string) => void
  placeholder?: string
  editable?: boolean
  appearance?: 'default' | 'plain'
}

export function TextEditor({
  value,
  onChange,
  placeholder = "What's on your mind?",
  editable = true,
  appearance = 'default',
}: TextEditorProps) {
  const { theme } = useThemeStore()
  const isPlain = appearance === 'plain'

  return (
    <View style={[styles.container, isPlain && styles.containerPlain]}>
      <TextInput
        style={[
          styles.input,
          isPlain && styles.inputPlain,
          {
            color: theme.text,
            backgroundColor: isPlain ? 'transparent' : theme.surface,
            borderColor: theme.border,
            borderRadius: isPlain ? 0 : theme.radius.medium,
            borderWidth: isPlain ? 0 : 1,
            fontSize: isPlain ? theme.typography.title : theme.typography.bodyLarge,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline
        editable={editable}
        textAlignVertical="top"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  containerPlain: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  input: {
    lineHeight: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 150,
  },
  inputPlain: {
    lineHeight: 30,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 220,
  },
})
