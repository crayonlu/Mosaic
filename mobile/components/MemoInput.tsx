import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import { useState } from 'react'
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native'
import { FullScreenEditor } from './FullScreenEditor'

interface MemoInputProps {
  onSubmit?: (content: string) => void
  placeholder?: string
  editable?: boolean
}

export function MemoInput({
  onSubmit,
  placeholder = '记录你的想法...',
  editable = true,
}: MemoInputProps) {
  const { theme } = useThemeStore()
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false)
  const [previewText, setPreviewText] = useState('')

  const handlePress = () => {
    if (editable) {
      setIsFullScreenVisible(true)
    }
  }

  const handleSubmit = (content: string) => {
    const textContent = stringUtils.extractTextFromHtml(content)
    setPreviewText(textContent)
    onSubmit?.(content)
  }

  const handleClose = () => {
    setIsFullScreenVisible(false)
  }

  const displayText = previewText || ''

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        disabled={!editable}
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: displayText ? theme.text : theme.textSecondary,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          value={displayText}
          editable={false}
          multiline={false}
          numberOfLines={1}
        />
      </TouchableOpacity>

      <FullScreenEditor
        visible={isFullScreenVisible}
        initialContent=""
        placeholder={placeholder}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    lineHeight: 20,
    padding: 0,
  },
})
