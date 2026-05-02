import { useThemeStore } from '@/stores/themeStore'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { useListContinuation } from './useListContinuation'

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
  const minHeight = useMemo(() => (isPlain ? 56 : 120), [isPlain])
  const [contentHeight, setContentHeight] = useState(minHeight)
  const { handleChange, handleSelectionChange } = useListContinuation(value, onChange)
  const computedHeight = Math.max(minHeight, contentHeight)

  useEffect(() => {
    if (!value.trim()) {
      setContentHeight(minHeight)
    }
  }, [value, minHeight])

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
            minHeight,
            height: computedHeight,
          },
        ]}
        value={value}
        onChangeText={handleChange}
        onSelectionChange={handleSelectionChange}
        onContentSizeChange={event => {
          const nextHeight = Math.ceil(event.nativeEvent.contentSize.height)
          if (nextHeight > 0) {
            setContentHeight(Math.max(minHeight, nextHeight))
          }
        }}
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
  },
  inputPlain: {
    lineHeight: 30,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
})
