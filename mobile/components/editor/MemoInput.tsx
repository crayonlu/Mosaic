import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/themeStore'
import { ArrowUp, Maximize2 } from 'lucide-react-native'
import { useCallback, useRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { runOnJS } from 'react-native-reanimated'
import { FullScreenEditor } from './FullScreenEditor'
import { useSafeKeyboardHandler } from '@/lib/native/safeProviders'

const COLLAPSED_HEIGHT = 48
const EXPANDED_HEIGHT = 130
const TOOLBAR_HEIGHT = 40

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
  placeholder,
  availableTags = [],
  disabled = false,
}: MemoInputProps) {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const resolvedPlaceholder = placeholder ?? t('memoInput.placeholder')
  const inputRef = useRef<TextInput>(null)
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false)
  const [text, setText] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const blurInput = useCallback(() => {
    inputRef.current?.blur()
  }, [])

  // The wrapper height is static (snapped on focus/blur): animating height from the
  // keyboard progress relayouts the subtree every frame and causes frame drops.
  useSafeKeyboardHandler(
    {
      onStart: e => {
        'worklet'
        // Collapse the input as soon as the keyboard starts hiding, so it does not
        // stay expanded until blur (blur fires only after the keyboard is gone).
        if (e.progress === 0) {
          runOnJS(blurInput)()
        }
      },
      onEnd: e => {
        'worklet'
        if (e.height === 0) {
          runOnJS(blurInput)()
        }
      },
    },
    []
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    onFocusChange?.(true)
  }, [onFocusChange])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    onFocusChange?.(false)
  }, [onFocusChange])

  const handleSubmit = useCallback(() => {
    if (!text.trim() || disabled) return
    onSubmit?.(text, [], [])
    setText('')
    blurInput()
  }, [text, disabled, onSubmit, blurInput])

  const handleFullScreenSubmit = useCallback(
    (content: string, submitTags: string[], resources: string[], aiSummary?: string) => {
      onSubmit?.(content, submitTags, resources, aiSummary)
      setIsFullScreenVisible(false)
      setText('')
    },
    [onSubmit]
  )

  const hasText = text.trim().length > 0

  return (
    <>
      <View
        style={[
          styles.wrapper,
          {
            backgroundColor: theme.surfaceMuted,
            borderRadius: theme.radius.medium,
            opacity: disabled ? theme.state.disabledOpacity : 1,
            paddingTop: 12,
            height: isFocused ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
            borderColor: 'transparent',
          },
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
            placeholder={resolvedPlaceholder}
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

        {/* Toolbar — only visible when expanded, height snapped with focus */}
        <View
          style={[
            styles.toolbar,
            { height: isFocused ? TOOLBAR_HEIGHT : 0 },
            { opacity: isFocused ? 1 : 0 },
          ]}
        >
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
        </View>
      </View>

      <FullScreenEditor
        visible={isFullScreenVisible}
        initialContent={text}
        initialTags={[]}
        placeholder={resolvedPlaceholder}
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
    paddingBottom: 12,
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
