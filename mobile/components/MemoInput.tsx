import { Colors } from '@/constants/colors'
import { useThemeStore } from '@/stores/theme-store'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

interface MemoInputProps {
  onSubmit?: (content: string) => void
  placeholder?: string
}

export function MemoInput({ onSubmit, placeholder = '记录你的想法...' }: MemoInputProps) {
  const { theme } = useThemeStore()
  const [content, setContent] = useState('')

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit?.(content.trim())
      setContent('')
    }
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
    >
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.surface,
            borderRadius: theme.borderRadius * 0.8,
            padding: theme.spacing * 0.75,
            borderWidth: 1.5,
            borderColor: theme.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={5000}
        />
      </View>
      <View>
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: theme.borderRadius * 0.8,
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            },
            !content.trim() && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!content.trim()}
        >
          <Text style={[styles.submitText, { color: Colors.primary.DEFAULT }]}>创建</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    minHeight: 80,
    maxHeight: 200,
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  submitButton: {
    alignSelf: 'flex-end',
    minWidth: 80,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
