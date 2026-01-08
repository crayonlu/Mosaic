import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import { useState, useEffect } from 'react'
import { StyleSheet, TextInput, View, TouchableOpacity } from 'react-native'
import { FullScreenEditor } from './FullScreenEditor'
import { Maximize2 } from 'lucide-react-native'
import { Button } from '@/components/ui'

interface MemoInputProps {
  onSubmit?: (content: string) => void
  placeholder?: string
}

export function MemoInput({ onSubmit, placeholder = '记录你的想法...' }: MemoInputProps) {
  const { theme } = useThemeStore()
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false)
  const [text, setText] = useState('')
  const [textContent, setTextContent] = useState('')

  useEffect(() => {
    if (text) setTextContent(stringUtils.extractTextFromHtml(text))
  }, [text])

  const handleSubmit = () => {
    if (!text.trim()) return
    if (textContent) {
      onSubmit?.(textContent)
      setText('')
    }
  }

  const handleFullScreenSubmit = (content: string) => {
    onSubmit?.(content)
    setIsFullScreenVisible(false)
  }

  return (
    <>
      <View style={styles.CT}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            editable={true}
            multiline={false}
            numberOfLines={1}
          />

          <TouchableOpacity
            onPress={() => setIsFullScreenVisible(true)}
            style={styles.expandButton}
          >
            <Maximize2 size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        <Button
          title="创建"
          variant={textContent ? 'primary' : 'secondary'}
          onPress={handleSubmit}
        />
      </View>
      <FullScreenEditor
        visible={isFullScreenVisible}
        initialContent={text}
        placeholder={placeholder}
        onClose={() => setIsFullScreenVisible(false)}
        onSubmit={handleFullScreenSubmit}
      />
    </>
  )
}

const styles = StyleSheet.create({
  CT: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
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
})
