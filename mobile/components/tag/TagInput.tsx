import { toast } from '@/components/ui/Toast'
import { useAIConfig } from '@/hooks/useAIConfig'
import { useAITags } from '@/hooks/useAITags'
import { normalizeContent } from '@/lib/utils/content'
import { useConnectionStore } from '@/stores/connectionStore'
import { useThemeStore } from '@/stores/themeStore'
import { X } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

interface TagInputProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  content?: string
  suggestions?: string[]
  placeholder?: string
  maxTags?: number
  appearance?: 'default' | 'plain'
}

type SuggestionItem = string

const SKELETON_WIDTHS = [64, 52, 72]

function SuggestionSkeleton() {
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      false
    )
  }, [opacity])

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <>
      {SKELETON_WIDTHS.map((w, i) => (
        <Animated.View
          key={i}
          style={[
            animStyle,
            {
              width: w,
              height: 27,
              borderRadius: 999,
              backgroundColor: '#d0d0d0',
            },
          ]}
        />
      ))}
    </>
  )
}

export function TagInput({
  tags,
  onTagsChange,
  content = '',
  suggestions = [],
  placeholder = '添加标签...',
  maxTags = 10,
  appearance = 'default',
}: TagInputProps) {
  const { theme } = useThemeStore()
  const isPlain = appearance === 'plain'
  const { isConnected } = useConnectionStore()
  const { isAIEnabled } = useAIConfig()
  const {
    suggestions: aiSuggestions,
    loading: aiLoading,
    error: aiError,
    suggest: getAISuggestions,
  } = useAITags()
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showAISuggestionsOnly, setShowAISuggestionsOnly] = useState(false)
  const lastToastErrorRef = useRef<string | null>(null)

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

  const shouldShowSuggestionPanel =
    showSuggestions &&
    (filteredSuggestions.length > 0 ||
      (showAISuggestionsOnly && (aiSuggestions.length > 0 || aiLoading || Boolean(aiError))))
  const canShowAIRecommend = Boolean(normalizeContent(content || '')) && isConnected && isAIEnabled

  useEffect(() => {
    if (!aiError) {
      lastToastErrorRef.current = null
      return
    }

    if (lastToastErrorRef.current === aiError) {
      return
    }

    toast.show({
      type: 'error',
      title: 'AI 标签推荐失败',
      message: aiError,
    })
    lastToastErrorRef.current = aiError
  }, [aiError])

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.container,
          isPlain && styles.containerPlain,
          {
            backgroundColor: isPlain ? 'transparent' : theme.surface,
            borderColor: theme.border,
            borderWidth: isPlain ? 0 : 1,
            borderRadius: theme.radius.medium,
            padding: isPlain ? 0 : theme.spacingScale.medium,
            minHeight: 48,
          },
        ]}
      >
        <View style={styles.tagsRow}>
          {tags.map(tag => (
            <View
              key={tag}
              style={[
                styles.tagChip,
                {
                  backgroundColor: theme.semantic.infoSoft,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.tagChipText, { color: theme.info }]} numberOfLines={1}>
                {tag}
              </Text>
              <TouchableOpacity
                onPress={() => removeTag(tag)}
                hitSlop={8}
                style={styles.tagChipRemove}
              >
                <X size={11} color={theme.info} />
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

        <View style={styles.aiButtonSlot}>
          <TouchableOpacity
            style={[
              styles.aiButton,
              aiLoading && styles.aiButtonLoading,
              !canShowAIRecommend && styles.aiButtonHidden,
            ]}
            onPress={handleAISuggest}
            disabled={!canShowAIRecommend || aiLoading}
          >
            <View
              style={[
                styles.aiButtonBadge,
                {
                  backgroundColor: isPlain ? theme.surfaceMuted : theme.semantic.infoSoft,
                  borderColor: theme.border,
                  borderWidth: isPlain ? 0 : 1,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text style={[styles.aiButtonText, { color: theme.primary }]}>AI 推荐</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {shouldShowSuggestionPanel && (
        <View style={styles.suggestionsInline}>
          {showAISuggestionsOnly && aiLoading && <SuggestionSkeleton />}
          {showAISuggestionsOnly && !aiLoading && !aiError && aiSuggestions.length === 0 && (
            <Text style={[styles.feedbackText, { color: theme.textSecondary }]}>暂无推荐标签</Text>
          )}
          {(showAISuggestionsOnly ? aiSuggestions : filteredSuggestions).map(
            (suggestion, index) => {
              const tagName = typeof suggestion === 'string' ? suggestion : suggestion.name
              return (
                <TouchableOpacity
                  key={`${tagName}-${index}`}
                  onPress={() => addTag(tagName)}
                  style={[
                    styles.suggestionChip,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.suggestionChipText, { color: theme.textSecondary }]}>
                    + {tagName}
                  </Text>
                </TouchableOpacity>
              )
            }
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  containerPlain: {
    gap: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  tagChipRemove: {
    width: 16,
    height: 16,
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
    borderRadius: 999,
    alignSelf: 'center',
    opacity: 1,
  },
  aiButtonSlot: {
    minWidth: 74,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonBadge: {
    minWidth: 66,
    height: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonHidden: {
    opacity: 0,
  },
  aiButtonLoading: {
    opacity: 0.7,
  },
  aiButtonText: {
    fontSize: 12,
  },
  suggestionsInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  suggestionChipText: {
    fontSize: 12,
  },
  feedbackText: {
    fontSize: 12,
  },
})
