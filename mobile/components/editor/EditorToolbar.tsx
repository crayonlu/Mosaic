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
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'

interface EditorToolbarProps {
  editor: EditorBridge
  onSave?: () => void
  onInsertLink?: () => void
}

export function EditorToolbar({ editor, onSave, onInsertLink }: EditorToolbarProps) {
  const { theme } = useThemeStore()

  // Helper to check if a mark is active (placeholder for future editor state tracking)
  const isMarkActive = (_markName: string): boolean => {
    return false
  }

  // Helper to check if a node is active
  const isNodeActive = (_nodeName: string): boolean => {
    return false
  }

  // Format buttons
  const formatButtons = [
    {
      icon: Bold,
      label: '粗体',
      onPress: () => editor.toggleBold(),
      isActive: isMarkActive('bold'),
    },
    {
      icon: Italic,
      label: '斜体',
      onPress: () => editor.toggleItalic(),
      isActive: isMarkActive('italic'),
    },
    {
      icon: Strikethrough,
      label: '删除线',
      onPress: () => {
        try {
          if ('toggleStrike' in editor && typeof editor.toggleStrike === 'function') {
            editor.toggleStrike()
          }
        } catch (error) {
          console.warn('Strike not supported:', error)
        }
      },
      isActive: isMarkActive('strike'),
    },
    {
      icon: Underline,
      label: '下划线',
      onPress: () => {
        try {
          if ('toggleUnderline' in editor && typeof editor.toggleUnderline === 'function') {
            editor.toggleUnderline()
          }
        } catch (error) {
          console.warn('Underline not supported:', error)
        }
      },
      isActive: isMarkActive('underline'),
    },
    {
      icon: Code,
      label: '行内代码',
      onPress: () => editor.toggleCode(),
      isActive: isMarkActive('code'),
    },
  ]

  // Structure buttons
  const structureButtons = [
    {
      icon: Heading1,
      label: '标题 1',
      onPress: () => editor.toggleHeading(1),
      isActive: isNodeActive('heading1'),
    },
    {
      icon: Heading2,
      label: '标题 2',
      onPress: () => editor.toggleHeading(2),
      isActive: isNodeActive('heading2'),
    },
    {
      icon: Heading3,
      label: '标题 3',
      onPress: () => editor.toggleHeading(3),
      isActive: isNodeActive('heading3'),
    },
    {
      icon: List,
      label: '无序列表',
      onPress: () => editor.toggleBulletList(),
      isActive: isNodeActive('bulletList'),
    },
    {
      icon: ListOrdered,
      label: '有序列表',
      onPress: () => editor.toggleOrderedList(),
      isActive: isNodeActive('orderedList'),
    },
    {
      icon: CheckSquare,
      label: '任务列表',
      onPress: () => editor.toggleTaskList(),
      isActive: isNodeActive('taskList'),
    },
    {
      icon: Quote,
      label: '引用',
      onPress: () => editor.toggleBlockquote(),
      isActive: isNodeActive('blockquote'),
    },
  ]

  // Insert buttons
  const insertButtons = [
    {
      icon: Link,
      label: '链接',
      onPress: () => {
        onInsertLink?.()
      },
      isActive: isMarkActive('link'),
    },
    {
      icon: Code2,
      label: '代码块',
      onPress: () => {
        try {
          if ('toggleCodeBlock' in editor && typeof editor.toggleCodeBlock === 'function') {
            editor.toggleCodeBlock()
          } else {
            editor.toggleCode()
          }
        } catch (error) {
          console.warn('Code block not supported:', error)
        }
      },
      isActive: isNodeActive('codeBlock'),
    },
  ]

  // Other buttons
  const otherButtons = [
    {
      icon: RemoveFormatting,
      label: '清除格式',
      onPress: () => {
        try {
          // Remove all marks - use unsetMark if available
          if ('unsetMark' in editor && typeof editor.unsetMark === 'function') {
            editor.unsetMark('bold')
            editor.unsetMark('italic')
            editor.unsetMark('strike')
            editor.unsetMark('underline')
            editor.unsetMark('code')
            editor.unsetMark('highlight')
            editor.unsetMark('link')
          }

          // Reset to paragraph
          if ('setParagraph' in editor && typeof editor.setParagraph === 'function') {
            editor.setParagraph()
          }
        } catch (error) {
          console.warn('Clear formatting error:', error)
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
      canExecute: true,
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
      canExecute: true,
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
