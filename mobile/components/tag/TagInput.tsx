import { Loading } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { useAIConfig } from '@/hooks/useAIConfig'
import { useAITags } from '@/hooks/useAITags'
import { normalizeContent } from '@/lib/utils/content'
import { useConnectionStore } from '@/stores/connectionStore'
import { useThemeStore } from '@/stores/themeStore'
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
  const [showAISuggestionsOnly, setShowAISuggestionsOnly] = useState(false)

  const allSuggestions: SuggestionItem[] = [...suggestions, ...aiSuggestions.map(s => s.name)]

  const filteredSuggestions = allSuggestions.filter(s => {
    if (showAISuggestionsOnly && aiSuggestions.some(ai => ai.name === s)) return !tags.includes(s)
    const matchInput = s.toLowerCase().includes(inputValue.toLowerCase())
    const notInTags = !tags.includes(s)
    return matchInput && notInTags
  })

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onTagsChange([...tags, trimmed])
      setInputValue('')
      // Don't hide suggestions when adding tags - let user add multiple tags
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
    const normalized = normalizeContent(content || '')
    if (normalized && isConnected && isAIEnabled) {
      setShowAISuggestionsOnly(true)
      setShowSuggestions(true)
      getAISuggestions(normalized)
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

        {normalizeContent(content || '') && isConnected && isAIEnabled && (
          <TouchableOpacity
            style={[styles.aiButton, aiLoading && styles.aiButtonLoading]}
            onPress={handleAISuggest}
          >
            {aiLoading ? (
              <Loading size="small" />
            ) : (
              <View
                style={{
                  backgroundColor: theme.primary + '15',
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  gap: 4,
                }}
              >
                <Sparkles size={14} color={theme.primary} />
                <Text style={[styles.aiButtonText, { color: theme.primary }]}>AI 推荐</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions &&
        (filteredSuggestions.length > 0 || (showAISuggestionsOnly && aiSuggestions.length > 0)) && (
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
              {(showAISuggestionsOnly ? aiSuggestions : filteredSuggestions).map(
                (suggestion, index) => {
                  const tagName = typeof suggestion === 'string' ? suggestion : suggestion.name
                  return (
                    <TouchableOpacity
                      key={`${tagName}-${index}`}
                      onPress={() => addTag(tagName)}
                      style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
                    >
                      <Text style={[styles.suggestionText, { color: theme.text }]}>{tagName}</Text>
                    </TouchableOpacity>
                  )
                }
              )}
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
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-end',
    opacity: 1,
  },
  aiButtonLoading: {
    opacity: 0.7,
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
