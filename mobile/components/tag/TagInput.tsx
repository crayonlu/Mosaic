import { Badge } from '@/components/ui/Badge'
import { useThemeStore } from '@/stores/theme-store'
import { X } from 'lucide-react-native'
import { useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'

interface TagInputProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  maxTags?: number
}

export function TagInput({
  tags,
  onTagsChange,
  suggestions = [],
  placeholder = '添加标签...',
  maxTags = 10,
}: TagInputProps) {
  const { theme } = useThemeStore()
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s)
  )

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

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: 12,
          backgroundColor: theme.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          minHeight: 48,
        }}
      >
        {tags.map(tag => (
          <View key={tag} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Badge text={tag} variant="soft" size="small" />
            <TouchableOpacity
              onPress={() => removeTag(tag)}
              hitSlop={8}
              style={{
                marginLeft: 4,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
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
            style={{
              flex: 1,
              minWidth: 80,
              fontSize: 14,
              color: theme.text,
              padding: 0,
            }}
          />
        )}
      </View>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <View
          style={{
            marginTop: 8,
            backgroundColor: theme.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            maxHeight: 150,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredSuggestions.map(suggestion => (
              <TouchableOpacity
                key={suggestion}
                onPress={() => addTag(suggestion)}
                style={{
                  padding: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 14 }}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )
}
