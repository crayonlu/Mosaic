import { useThemeStore } from '@/stores/theme-store'
import { RichText, useEditorBridge, useEditorContent } from '@10play/tentap-editor'
import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { EditorToolbar } from './EditorToolbar'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  editable?: boolean
  onSave?: () => void
  isExpanded?: boolean
  showCreateButton?: boolean
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = '输入内容...',
  editable = true,
  onSave,
  isExpanded = false,
  showCreateButton = false,
}: RichTextEditorProps) {
  const { theme } = useThemeStore()
  const previousContentRef = useRef<string>(content)

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: content || '',
  })

  // Sync content changes from parent
  useEffect(() => {
    if (editor && content !== previousContentRef.current) {
      const syncContent = async () => {
        try {
          const currentContent = await editor.getHTML()
          if (currentContent !== content) {
            editor.setContent(content)
            previousContentRef.current = content
          }
        } catch (error) {
          console.error('Failed to sync content:', error)
        }
      }
      syncContent()
    }
  }, [content, editor])

  // Use useEditorContent hook to listen to content changes
  const editorContent = useEditorContent(editor, { type: 'html', debounceInterval: 300 })

  // Sync editor content changes to parent
  useEffect(() => {
    if (editorContent && editorContent !== previousContentRef.current) {
      previousContentRef.current = editorContent
      onChange(editorContent)
    }
  }, [editorContent, onChange])

  // Handle editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Note: Save shortcut handling would be implemented via toolbar button
  // Mobile devices don't have Ctrl/Cmd keys, so we rely on toolbar actions

  if (!editor) {
    return null
  }

  return (
    <>
      <View
        style={[
          styles.container,
        ]}
      >
        {editable && <EditorToolbar editor={editor} onSave={onSave} />}
        <View
          style={[
            styles.editorContainer,
            {
              minHeight: editable ? 120 : 60,
              maxHeight: isExpanded ? undefined : 400,
            },
          ]}
        >
          <RichText editor={editor} style={[styles.richText, { backgroundColor: theme.background }]} />
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  editorContainer: {
    flex: 1,
    padding: 12,
    position: 'relative',
  },
  richText: {
    flex: 1,
  },
})
