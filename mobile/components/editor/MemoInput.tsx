import { Button } from '@/components/ui'
import { useThemeStore } from '@/stores/themeStore'
import { Maximize2 } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Keyboard, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { FullScreenEditor } from './FullScreenEditor'

interface MemoInputProps {
  onSubmit?: (content: string, tags: string[], resources: string[], aiSummary?: string) => void
  placeholder?: string
  availableTags?: string[]
  disabled?: boolean
}

export function MemoInput({
  onSubmit,
  placeholder = '记录你的想法...',
  availableTags = [],
  disabled = false,
}: MemoInputProps) {
  const { theme } = useThemeStore()
  const inputRef = useRef<TextInput>(null)
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false)
  const [text, setText] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      inputRef.current?.blur()
    })
    return () => sub.remove()
  }, [])

  const handleSubmit = () => {
    if (!text.trim() || disabled) return
    onSubmit?.(text, [], [])
    setText('')
  }

  const handleFullScreenSubmit = (
    content: string,
    submitTags: string[],
    resources: string[],
    aiSummary?: string
  ) => {
    onSubmit?.(content, submitTags, resources, aiSummary)
    setIsFullScreenVisible(false)
    setText('')
  }

  return (
    <>
      <View style={styles.container}>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: isFocused ? theme.primary : 'transparent',
              borderWidth: 1,
              borderRadius: theme.radius.medium,
              paddingHorizontal: theme.spacingScale.medium,
              height: 48,
              opacity: disabled ? theme.state.disabledOpacity : 1,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.text, fontSize: theme.typography.bodyLarge }]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={!disabled}
            multiline={false}
            numberOfLines={1}
          />

          <TouchableOpacity
            onPress={() => setIsFullScreenVisible(true)}
            style={styles.expandButton}
            disabled={disabled}
          >
            <Maximize2 size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="创建"
            variant={text ? 'primary' : 'secondary'}
            onPress={handleSubmit}
            disabled={disabled || !text}
          />
        </View>
      </View>

      <FullScreenEditor
        visible={isFullScreenVisible}
        initialContent={text}
        initialTags={[]}
        placeholder={placeholder}
        availableTags={availableTags}
        onClose={() => setIsFullScreenVisible(false)}
        onSubmit={handleFullScreenSubmit}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    flexDirection: 'row',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    paddingVertical: 0,
  },
  expandButton: {
    padding: 8,
    marginLeft: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
})
