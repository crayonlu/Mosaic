import { useThemeStore } from '@/stores/themeStore'
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Markdown from 'react-native-markdown-display'
import SyntaxHighlighter from 'react-native-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs'

interface MarkdownRendererProps {
  content: string
  style?: object
}

export function MarkdownRenderer({ content, style }: MarkdownRendererProps) {
  const { theme } = useThemeStore()

  if (!content || content.trim().length === 0) {
    return null
  }

  return <MarkdownContent content={content} theme={theme} style={style} />
}

function MarkdownContent({
  content,
  theme,
  style,
}: {
  content: string
  theme: {
    text: string
    primary: string
    textSecondary: string
    border: string
    surfaceMuted: string
  }
  style?: object
}) {
  const markdownIt = useMemo(() => {
    const parser = MarkdownIt({
      html: false,
      typographer: true,
      breaks: true,
      linkify: true,
    })

    parser.use(taskLists, { enabled: true, label: true, labelAfter: false })
    return parser
  }, [])

  const markdownText = useMemo(
    () => content.replace(/^- \[[xX]\]\s+/gm, '- ☑ ').replace(/^- \[\s\]\s+/gm, '- ☐ '),
    [content]
  )

  const markdownStyles = useMemo(
    () => ({
      body: { color: theme.text, fontSize: 16, lineHeight: 24 },
      paragraph: { marginTop: 0, marginBottom: 8 },
      heading1: {
        color: theme.text,
        fontSize: 28,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 12,
      },
      heading2: {
        color: theme.text,
        fontSize: 24,
        fontWeight: '600',
        marginTop: 6,
        marginBottom: 10,
      },
      heading3: {
        color: theme.text,
        fontSize: 20,
        fontWeight: '600',
        marginTop: 4,
        marginBottom: 8,
      },
      hr: { backgroundColor: theme.border, height: StyleSheet.hairlineWidth, marginVertical: 10 },
      blockquote: {
        borderLeftColor: theme.border,
        borderLeftWidth: 3,
        paddingLeft: 12,
        marginBottom: 8,
      },
      bullet_list_icon: { color: theme.primary },
      ordered_list_icon: { color: theme.primary },
      list_item: { color: theme.text, marginBottom: 4 },
      strong: { fontWeight: '700' },
      em: { fontStyle: 'italic' },
      s: { textDecorationLine: 'line-through' },
      link: { color: theme.primary, textDecorationLine: 'underline' },
      code_inline: {
        backgroundColor: theme.textSecondary + '20',
        borderRadius: 4,
        paddingHorizontal: 4,
        fontFamily: 'monospace',
      },
      table: { borderColor: theme.border, borderWidth: 1, marginBottom: 8 },
      thead: { backgroundColor: theme.surfaceMuted },
      th: {
        borderColor: theme.border,
        borderWidth: 1,
        padding: 6,
        color: theme.text,
        fontWeight: '700',
      },
      td: { borderColor: theme.border, borderWidth: 1, padding: 6, color: theme.text },
    }),
    [theme]
  )

  return (
    <View style={[styles.container, style]}>
      <Markdown
        markdownit={markdownIt}
        style={markdownStyles as any}
        rules={{
          fence: (node, _children, _parent, _styles) => {
            const language = (node as any).sourceInfo?.trim()?.split(/\s+/)[0] || 'text'
            const code = node.content || ''
            return (
              <View key={node.key} style={styles.codeBlockContainer}>
                <Text style={styles.codeBlockLang}>{language}</Text>
                <SyntaxHighlighter language={language} style={atomOneDark} highlighter="hljs">
                  {code}
                </SyntaxHighlighter>
              </View>
            )
          },
          code_block: (node, _children, _parent, _styles) => (
            <View key={node.key} style={styles.codeBlockContainer}>
              <SyntaxHighlighter language="text" style={atomOneDark} highlighter="hljs">
                {node.content || ''}
              </SyntaxHighlighter>
            </View>
          ),
        }}
      >
        {markdownText}
      </Markdown>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  codeBlockContainer: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  codeBlockLang: {
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#d0d0d0',
    backgroundColor: '#1e1e1e',
    textTransform: 'lowercase',
  },
})
