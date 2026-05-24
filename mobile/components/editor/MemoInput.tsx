import i18n from '@/lib/i18n'
import { useThemeStore } from '@/stores/themeStore'
import { ArrowUp, Maximize2 } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { FullScreenEditor } from './FullScreenEditor'

const COLLAPSED_HEIGHT = 48
const EXPANDED_HEIGHT = 130
const ANIM_DURATION = 200

interface MemoInputProps {
  onSubmit?: (content: string, tags: string[], resources: string[], aiSummary?: string) => void
  onFocusChange?: (focused: boolean) => void
  placeholder?: string
  availableTags?: string[]
  disabled?: boolean
}

export function MemoInput({
  onSubmit,
  onFocusChange,
  placeholder = i18n.t('memoInput.placeholder'),
  availableTags = [],
  disabled = false,
}: MemoInputProps) {
  const { theme } = useThemeStore()
  const inputRef = useRef<TextInput>(null)
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false)
  const [text, setText] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const wrapperHeight = useSharedValue(COLLAPSED_HEIGHT)
  const expandProgress = useSharedValue(0)

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      inputRef.current?.blur()
    })
    return () => sub.remove()
  }, [])

  const handleFocus = () => {
    setIsFocused(true)
    onFocusChange?.(true)
    wrapperHeight.value = withTiming(EXPANDED_HEIGHT, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    })
    expandProgress.value = withTiming(1, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    })
  }

  const handleBlur = () => {
    setIsFocused(false)
    onFocusChange?.(false)
    wrapperHeight.value = withTiming(COLLAPSED_HEIGHT, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    })
    expandProgress.value = withTiming(0, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    })
  }

  const wrapperAnimStyle = useAnimatedStyle(() => ({
    height: wrapperHeight.value,
  }))

  const toolbarAnimStyle = useAnimatedStyle(() => ({
    opacity: expandProgress.value,
    height: expandProgress.value * 40,
    overflow: 'hidden' as const,
  }))

  const handleSubmit = () => {
    if (!text.trim() || disabled) return
    onSubmit?.(text, [], [])
    setText('')
    inputRef.current?.blur()
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

  const hasText = text.trim().length > 0

  return (
    <>
      <Animated.View
        style={[
          styles.wrapper,
          {
            backgroundColor: theme.surfaceMuted,
            borderColor: isFocused ? theme.border : 'transparent',
            borderRadius: theme.radius.medium,
            opacity: disabled ? theme.state.disabledOpacity : 1,
            paddingTop: 12,
            paddingBottom: isFocused ? 4 : 12,
          },
          wrapperAnimStyle,
        ]}
      >
        {/* Input area: single-line collapsed, multiline expanded */}
        <View style={[styles.inputRow, isFocused && styles.inputRowExpanded]}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: theme.text,
                fontSize: theme.typography.bodyLarge.fontSize,
              },
              !isFocused && styles.inputCollapsed,
            ]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={!disabled}
            multiline={isFocused}
            textAlignVertical={isFocused ? 'top' : 'center'}
          />

          {/* Inline expand icon — only visible in collapsed state */}
          {!isFocused && (
            <Pressable
              onPress={() => setIsFullScreenVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={disabled}
              style={styles.inlineExpandButton}
            >
              <Maximize2 size={18} color={theme.textSecondary} strokeWidth={1.8} />
            </Pressable>
          )}
        </View>

        {/* Toolbar — only visible when expanded, animated height */}
        <Animated.View style={[styles.toolbar, toolbarAnimStyle]}>
          <Pressable
            onPress={() => setIsFullScreenVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={disabled}
            style={styles.toolbarButton}
          >
            <Maximize2 size={18} color={theme.textSecondary} strokeWidth={1.8} />
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={disabled || !hasText}
            style={[
              styles.sendButton,
              {
                backgroundColor: hasText ? theme.primary : theme.surfaceMuted,
              },
            ]}
          >
            <ArrowUp
              size={18}
              color={hasText ? theme.onPrimary : theme.textSecondary}
              strokeWidth={2.5}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>

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
  wrapper: {
    borderWidth: 1,
    paddingHorizontal: 14,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRowExpanded: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  inputCollapsed: {
    height: 28,
  },
  inlineExpandButton: {
    padding: 4,
    marginLeft: 8,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarButton: {
    padding: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
