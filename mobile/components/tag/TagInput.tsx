import { Loading } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { useAIConfig } from '@/hooks/use-ai-config'
import { useAITags } from '@/hooks/use-ai-tags'
import { useConnectionStore } from '@/stores/connection-store'
import { useThemeStore } from '@/stores/theme-store'
import { Sparkles, X } from 'lucide-react-native'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

interface TagInputProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  content?: string
  suggestions?: string[]
  placeholder?: string
  maxTags?: number
}

type SuggestionItem = string

export function TagInput({
  tags,
  onTagsChange,
  content = '',
  suggestions = [],
  placeholder = '添加标签...',
  maxTags = 10,
}: TagInputProps) {
  const { theme } = useThemeStore()
  const { isConnected } = useConnectionStore()
  const { isAIEnabled } = useAIConfig()
  const { suggestions: aiSuggestions, loading: aiLoading, suggest: getAISuggestions } = useAITags()
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const allSuggestions: SuggestionItem[] = [...suggestions, ...aiSuggestions.map(s => s.name)]

  const filteredSuggestions = allSuggestions.filter(s => {
    const matchInput = s.toLowerCase().includes(inputValue.toLowerCase())
    const notInTags = !tags.includes(s)
    return matchInput && notInTags
  })

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onTagsChange([...tags, trimmed])
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(t => t !== tagToRemove))
  }

  const handleSubmit = () => {
    if (inputValue.trim()) {
      addTag(inputValue)
    }
  }

  const handleAISuggest = () => {
    if (content && isConnected && isAIEnabled) {
      getAISuggestions(content)
      setShowSuggestions(true)
    }
  }

  return (
    <View>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
            borderWidth: 1,
            minHeight: 48,
          },
        ]}
      >
        <View style={styles.tagsRow}>
          {tags.map(tag => (
            <View key={tag} style={styles.tagWrapper}>
              <Badge text={tag} variant="soft" size="small" />
              <TouchableOpacity
                onPress={() => removeTag(tag)}
                hitSlop={8}
                style={[styles.removeButton, { backgroundColor: theme.border }]}
              >
                <X size={10} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}

          {tags.length < maxTags && (
            <TextInput
              value={inputValue}
              onChangeText={text => {
                setInputValue(text)
                setShowSuggestions(text.length > 0 && filteredSuggestions.length > 0)
              }}
              onSubmitEditing={handleSubmit}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onFocus={() =>
                inputValue.length > 0 && filteredSuggestions.length > 0 && setShowSuggestions(true)
              }
              placeholder={tags.length === 0 ? placeholder : ''}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
            />
          )}
        </View>

        {content && isConnected && isAIEnabled && (
          <TouchableOpacity
            style={[styles.aiButton, { backgroundColor: theme.primary + '15' }]}
            onPress={handleAISuggest}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <Loading size="small" />
            ) : (
              <>
                <Sparkles size={14} color={theme.primary} />
                <Text style={[styles.aiButtonText, { color: theme.primary }]}>AI 推荐</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsContainer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={`${suggestion}-${index}`}
                onPress={() => addTag(suggestion)}
                style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
              >
                <Text style={[styles.suggestionText, { color: theme.text }]}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tagWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeButton: {
    marginLeft: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 80,
    fontSize: 14,
    padding: 0,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  aiButtonText: {
    fontSize: 12,
  },
  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 8,
    maxHeight: 150,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
  },
})
