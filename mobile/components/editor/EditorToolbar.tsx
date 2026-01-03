import { useThemeStore } from '@/stores/theme-store'
import { EditorBridge } from '@10play/tentap-editor'
import {
    Bold,
    CheckSquare,
    Code,
    Code2,
    Heading1,
    Heading2,
    Heading3,
    Highlighter,
    Italic,
    Link,
    List,
    ListOrdered,
    Quote,
    Redo2,
    RemoveFormatting,
    Strikethrough,
    Underline,
    Undo2,
} from 'lucide-react-native'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

interface EditorToolbarProps {
  editor: EditorBridge
  onSave?: () => void
}

export function EditorToolbar({ editor, onSave }: EditorToolbarProps) {
  const { theme } = useThemeStore()
  // Note: Active states would be managed via editor state polling or events
  // For now, we'll use a simple approach without real-time state tracking
  const [activeStates] = useState<Record<string, boolean>>({})

  // Format buttons
  const formatButtons = [
    {
      icon: Bold,
      label: '粗体',
      onPress: () => editor.toggleBold(),
      isActive: activeStates.bold,
    },
    {
      icon: Italic,
      label: '斜体',
      onPress: () => editor.toggleItalic(),
      isActive: activeStates.italic,
    },
    {
      icon: Strikethrough,
      label: '删除线',
      onPress: () => {
        try {
          // toggleStrike may require a parameter or may not be available
          if ('toggleStrike' in editor && typeof editor.toggleStrike === 'function') {
            editor.toggleStrike()
          }
        } catch (error) {
          console.warn('Strike not supported:', error)
        }
      },
      isActive: activeStates.strike,
    },
    {
      icon: Underline,
      label: '下划线',
      onPress: () => {
        try {
          // toggleUnderline may require a parameter or may not be available
          if ('toggleUnderline' in editor && typeof editor.toggleUnderline === 'function') {
            editor.toggleUnderline()
          }
        } catch (error) {
          console.warn('Underline not supported:', error)
        }
      },
      isActive: activeStates.underline,
    },
    {
      icon: Code,
      label: '行内代码',
      onPress: () => editor.toggleCode(),
      isActive: activeStates.code,
    },
    {
      icon: Highlighter,
      label: '高亮',
      onPress: () => {
        // Note: toggleHighlight may require a color parameter or may not be available
        try {
          if ('toggleHighlight' in editor && typeof editor.toggleHighlight === 'function') {
            // Try with default color or no parameter
            const highlightMethod = editor.toggleHighlight as any
            if (highlightMethod.length === 0) {
              highlightMethod()
            } else {
              highlightMethod({ color: '#FFD93D' }) // Default highlight color
            }
          }
        } catch (error) {
          console.warn('Highlight not supported:', error)
        }
      },
      isActive: activeStates.highlight,
    },
  ]

  // Structure buttons
  const structureButtons = [
    {
      icon: Heading1,
      label: '标题 1',
      onPress: () => editor.toggleHeading(1),
      isActive: activeStates.heading1,
    },
    {
      icon: Heading2,
      label: '标题 2',
      onPress: () => editor.toggleHeading(2),
      isActive: activeStates.heading2,
    },
    {
      icon: Heading3,
      label: '标题 3',
      onPress: () => editor.toggleHeading(3),
      isActive: activeStates.heading3,
    },
    {
      icon: List,
      label: '无序列表',
      onPress: () => editor.toggleBulletList(),
      isActive: activeStates.bulletList,
    },
    {
      icon: ListOrdered,
      label: '有序列表',
      onPress: () => editor.toggleOrderedList(),
      isActive: activeStates.orderedList,
    },
    {
      icon: CheckSquare,
      label: '任务列表',
      onPress: () => editor.toggleTaskList(),
      isActive: activeStates.taskList,
    },
    {
      icon: Quote,
      label: '引用',
      onPress: () => editor.toggleBlockquote(),
      isActive: activeStates.blockquote,
    },
  ]

  // Insert buttons
  const insertButtons = [
    {
      icon: Link,
      label: '链接',
      onPress: () => {
        // TODO: Implement link dialog
        console.log('Insert link')
      },
      isActive: activeStates.link,
    },
    {
      icon: Code2,
      label: '代码块',
      onPress: () => {
        // Note: Code block may need special handling
        try {
          // Try toggleCodeBlock if available, otherwise use toggleCode
          if ('toggleCodeBlock' in editor && typeof editor.toggleCodeBlock === 'function') {
            editor.toggleCodeBlock()
          } else {
            editor.toggleCode()
          }
        } catch (error) {
          console.warn('Code block not supported:', error)
        }
      },
      isActive: activeStates.codeBlock,
    },
  ]

  // Other buttons
  const otherButtons = [
    {
      icon: RemoveFormatting,
      label: '清除格式',
      onPress: () => {
        // Note: clearNodes and unsetAllMarks may not be available
        // This is a placeholder for future implementation
        try {
          if ('clearNodes' in editor && typeof editor.clearNodes === 'function') {
            editor.clearNodes()
          }
          if ('unsetAllMarks' in editor && typeof editor.unsetAllMarks === 'function') {
            editor.unsetAllMarks()
          }
        } catch (error) {
          console.warn('Clear formatting not fully supported:', error)
        }
      },
      isActive: false,
    },
    {
      icon: Undo2,
      label: '撤销',
      onPress: () => {
        try {
          editor.undo()
        } catch (error) {
          console.warn('Undo not available:', error)
        }
      },
      isActive: false,
      canExecute: true, // TODO: Check if undo is available
    },
    {
      icon: Redo2,
      label: '重做',
      onPress: () => {
        try {
          editor.redo()
        } catch (error) {
          console.warn('Redo not available:', error)
        }
      },
      isActive: false,
      canExecute: true, // TODO: Check if redo is available
    },
  ]

  const ToolbarButton = ({
    icon: Icon,
    label,
    onPress,
    isActive,
    canExecute,
  }: {
    icon: typeof Bold
    label: string
    onPress: () => void
    isActive?: boolean
    canExecute?: boolean
  }) => {
    const active = isActive || false
    const canRun = canExecute !== false

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={!canRun}
        style={[
          styles.button,
          {
            backgroundColor: active ? theme.border : 'transparent',
            borderColor: theme.border,
          },
          !canRun && styles.buttonDisabled,
        ]}
        activeOpacity={0.7}
      >
        <Icon
          size={20}
          color={active ? theme.text : theme.textSecondary}
          strokeWidth={active ? 2.5 : 2}
        />
      </TouchableOpacity>
    )
  }

  const Separator = () => (
    <View
      style={[
        styles.separator,
        {
          backgroundColor: theme.border,
        },
      ]}
    />
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
            borderBottomWidth: 1,
            borderTopWidth: 1,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}
        >
          {/* Format buttons */}
          <View style={styles.buttonGroup}>
            {formatButtons.map((btn, index) => (
              <ToolbarButton key={index} {...btn} />
            ))}
          </View>

          <Separator />

          {/* Structure buttons */}
          <View style={styles.buttonGroup}>
            {structureButtons.map((btn, index) => (
              <ToolbarButton key={index} {...btn} />
            ))}
          </View>

          <Separator />

          {/* Insert buttons */}
          <View style={styles.buttonGroup}>
            {insertButtons.map((btn, index) => (
              <ToolbarButton key={index} {...btn} />
            ))}
          </View>

          <Separator />

          {/* Other buttons */}
          <View style={styles.buttonGroup}>
            {otherButtons.map((btn, index) => (
              <ToolbarButton key={index} {...btn} />
            ))}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  toolbarContent: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  separator: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
})
