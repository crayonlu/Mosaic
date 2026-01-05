import { useThemeStore } from '@/stores/theme-store'
import { RichText, useEditorBridge, useEditorContent } from '@10play/tentap-editor'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { EditorToolbar } from './EditorToolbar'
import { LinkDialog } from './LinkDialog'
import { marked } from 'marked'

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
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)

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

  // Handle link insertion
  const handleInsertLink = (url: string, text: string) => {
    if (editor) {
      const linkText = text || url
      // Use insertHTML if available, otherwise use setContent
      if ('insertHTML' in editor && typeof editor.insertHTML === 'function') {
        editor.insertHTML(`<a href="${url}">${linkText}</a>`)
      } else {
        // Fallback: get current content and append link
        editor.getHTML().then(currentContent => {
          editor.setContent(currentContent + `<a href="${url}">${linkText}</a>`)
        })
      }
    }
  }

  // Handle paste with Markdown support
  const handlePaste = (event: any) => {
    const pastedText = event.clipboardData?.getData('text/plain') || ''

    // Check for Markdown syntax
    const hasMarkdownSyntax =
      /(#+\s|^\s*[-*+]\s|\*\*.*\*\*|\*.*\*|`.*`|^\s*\d+\.\s|\[.*\]\(.*\)|^\s*>)/m.test(
        pastedText
      )

    if (hasMarkdownSyntax) {
      try {
        const htmlContent = marked.parse(pastedText)
        // Use insertHTML if available
        if ('insertHTML' in editor && typeof editor.insertHTML === 'function') {
          editor.insertHTML(htmlContent)
        } else {
          editor.getHTML().then(currentContent => {
            editor.setContent(currentContent + htmlContent)
          })
        }
        return true
      } catch (error) {
        console.warn('Failed to parse pasted Markdown:', error)
      }
    }

    return false
  }

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
        {editable && (
          <EditorToolbar
            editor={editor}
            onSave={onSave}
            onInsertLink={() => setIsLinkDialogOpen(true)}
          />
        )}
        <View
          style={[
            styles.editorContainer,
            {
              minHeight: editable ? 120 : 60,
              maxHeight: isExpanded ? undefined : 400,
            },
          ]}
        >
          <RichText
            editor={editor}
            style={[styles.richText, { backgroundColor: theme.background }]}
          />
        </View>
      </View>

      <LinkDialog
        visible={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        onInsert={handleInsertLink}
      />
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
