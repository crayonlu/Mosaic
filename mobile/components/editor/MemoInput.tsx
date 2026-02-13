import { Button } from '@/components/ui'
import { useThemeStore } from '@/stores/theme-store'
import { Maximize2 } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { FullScreenEditor } from './FullScreenEditor'

interface MemoInputProps {
  onSubmit?: (content: string, tags: string[], resources: string[]) => void
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
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false)
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (!text.trim() || disabled) return
    onSubmit?.(text, [], [])
    setText('')
  }

  const handleFullScreenSubmit = (content: string, submitTags: string[], resources: string[]) => {
    onSubmit?.(content, submitTags, resources)
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
              backgroundColor: theme.background,
              borderColor: theme.border,
              borderWidth: 1,
              opacity: disabled ? 0.6 : 1,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
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
    display: 'flex',
    flexDirection: 'row',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
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
