import type { Theme } from '@/constants/theme'
import { useThemeStore } from '@/stores/themeStore'
import { common, createLowlight } from 'lowlight'
import taskLists from 'markdown-it-task-lists'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Markdown, { MarkdownIt } from 'react-native-markdown-display'

const lowlight = createLowlight()
lowlight.register(common)

type CodeSegment = {
  text: string
  tokenType?: string
}

function collectSegments(node: any, activeToken: string | undefined, segments: CodeSegment[]) {
  if (!node) return

  if (node.type === 'text') {
    if (node.value) {
      segments.push({ text: String(node.value), tokenType: activeToken })
    }
    return
  }

  if (node.type === 'element') {
    const classNames = Array.isArray(node.properties?.className)
      ? (node.properties.className as string[])
      : []
    const hljsClass = classNames.find(className => className.startsWith('hljs-'))
    const nextToken = hljsClass ? hljsClass.replace('hljs-', '') : activeToken
    const children = Array.isArray(node.children) ? node.children : []
    for (const child of children) {
      collectSegments(child, nextToken, segments)
    }
    return
  }

  const children = Array.isArray(node.children) ? node.children : []
  for (const child of children) {
    collectSegments(child, activeToken, segments)
  }
}

function getCodeSegments(code: string, language: string): CodeSegment[] {
  const normalizedLanguage = language.trim().toLowerCase()
  const canHighlight = normalizedLanguage && lowlight.registered(normalizedLanguage)
  const tree = canHighlight
    ? lowlight.highlight(normalizedLanguage, code)
    : lowlight.highlightAuto(code)

  const segments: CodeSegment[] = []
  for (const child of tree.children ?? []) {
    collectSegments(child, undefined, segments)
  }

  if (segments.length === 0) {
    return [{ text: code }]
  }
  return segments
}

function tokenStyle(tokenType?: string) {
  switch (tokenType) {
    case 'keyword':
    case 'selector-tag':
    case 'title':
    case 'section':
    case 'type':
    case 'name':
      return styles.codeTokenKeyword
    case 'string':
      return styles.codeTokenString
    case 'number':
    case 'literal':
    case 'symbol':
      return styles.codeTokenNumber
    case 'comment':
      return styles.codeTokenComment
    case 'function':
    case 'attr':
      return styles.codeTokenFunction
    default:
      return undefined
  }
}

function CodeBlock({ language, code, theme }: { language: string; code: string; theme: Theme }) {
  const segments = useMemo(() => getCodeSegments(code, language), [code, language])

  const themedStyles = useMemo(
    () => ({
      container: {
        borderColor: theme.border,
        backgroundColor: theme.surface,
      },
      header: {
        backgroundColor: theme.surfaceStrong,
        borderBottomColor: theme.border,
      },
      lang: {
        color: theme.textSecondary,
      },
      body: {
        backgroundColor: theme.surface,
      },
      text: {
        color: theme.text,
        fontFamily: theme.fontFamilyMono,
      },
    }),
    [theme]
  )

  return (
    <View style={[styles.codeBlockContainer, themedStyles.container]}>
      <View style={[styles.codeBlockHeader, themedStyles.header]}>
        <Text style={[styles.codeBlockLang, themedStyles.lang]}>{language}</Text>
      </View>
      <View style={[styles.codeBlockBody, themedStyles.body]}>
        <Text style={[styles.codeBlockText, themedStyles.text]}>
          {segments.map((segment, index) => (
            <Text
              key={`seg-${index}`}
              style={[styles.codeBlockText, themedStyles.text, tokenStyle(segment.tokenType)]}
            >
              {segment.text}
            </Text>
          ))}
        </Text>
      </View>
    </View>
  )
}

function normalizeMarkdownForRender(source: string): string {
  const normalized = source.replace(/[｜﹨|]/g, '|').replace(/[－—–]/g, '-')

  const lines = normalized.split('\n').map(line => {
    const trimmed = line.trim()
    const looksLikeTableLine = /^\|.*\|$/.test(trimmed)
    if (!looksLikeTableLine) {
      return line
    }

    // Some inputs add a trailing '\\' to force hard-breaks, which prevents markdown-it
    // from recognizing GFM table rows. Strip it only for table-like lines at render time.
    return line.replace(/\s*\\\s*$/, '')
  })
  const output: string[] = []

  const isTableHeader = (line: string) => /^\s*\|?.+\|.+\|?\s*$/.test(line)
  const isTableSeparator = (line: string) =>
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index]
    const next = lines[index + 1] ?? ''
    const previous = output[output.length - 1] ?? ''

    const maybeTableStart = isTableHeader(current) && isTableSeparator(next)
    if (maybeTableStart && previous.trim().length > 0) {
      output.push('')
    }

    output.push(current)
  }

  return output.join('\n')
}

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
  theme: Theme
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
    parser.enable(['table'])
    return parser
  }, [])

  const markdownText = useMemo(
    () =>
      normalizeMarkdownForRender(content)
        .replace(/^- \[[xX]\]\s+/gm, '- ☑ ')
        .replace(/^- \[\s\]\s+/gm, '- ☐ '),
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
      link: {
        color: theme.primary,
        textDecorationLine: 'underline',
        fontWeight: '600',
        letterSpacing: 0.2,
      },
      code_inline: {
        backgroundColor: theme.textSecondary + '20',
        fontFamily: theme.fontFamilyMono,
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
          hr: node => (
            <View key={node.key} style={[styles.hr, { backgroundColor: theme.border }]} />
          ),
          blockquote: (node, children) => (
            <View key={node.key} style={styles.blockquoteContainer}>
              <View style={[styles.blockquoteBar, { backgroundColor: theme.border }]} />
              <View style={styles.blockquoteContent}>{children}</View>
            </View>
          ),
          table: (node, children) => (
            <ScrollView
              key={node.key}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tableScroll}
            >
              <View style={[styles.tableContainer, { borderColor: theme.border }]}>{children}</View>
            </ScrollView>
          ),
          thead: (node, children) => <View key={node.key}>{children}</View>,
          tbody: (node, children) => <View key={node.key}>{children}</View>,
          tr: (node, children) => (
            <View key={node.key} style={[styles.tableRow, { borderBottomColor: theme.border }]}>
              {children}
            </View>
          ),
          th: (node, children) => (
            <View
              key={node.key}
              style={[
                styles.tableCell,
                styles.tableHeaderCell,
                { borderRightColor: theme.border, backgroundColor: theme.surfaceMuted },
              ]}
            >
              <Text style={[styles.tableHeaderText, { color: theme.text }]}>{children}</Text>
            </View>
          ),
          td: (node, children) => (
            <View key={node.key} style={[styles.tableCell, { borderRightColor: theme.border }]}>
              <Text style={[styles.tableCellText, { color: theme.text }]}>{children}</Text>
            </View>
          ),
          code_inline: node => {
            const value = String((node as any).content ?? '')
            return (
              <Text
                key={node.key}
                style={[
                  styles.inlineCode,
                  {
                    backgroundColor: theme.textSecondary + '20',
                    color: theme.text,
                    fontFamily: theme.fontFamilyMono,
                  },
                ]}
              >
                {'\u00A0'}
                {value}
                {'\u00A0'}
              </Text>
            )
          },
          fence: (node, _children, _parent, _styles) => {
            const language = (node as any).sourceInfo?.trim()?.split(/\s+/)[0] || 'text'
            const code = node.content || ''
            return <CodeBlock key={node.key} language={language} code={code} theme={theme} />
          },
          code_block: (node, _children, _parent, _styles) => (
            <CodeBlock key={node.key} language="text" code={node.content || ''} theme={theme} />
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
  hr: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
    width: '100%',
  },
  blockquoteContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  blockquoteBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 10,
  },
  blockquoteContent: {
    flex: 1,
    paddingTop: 1,
  },
  inlineCode: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  codeBlockContainer: {
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
  codeBlockHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  codeBlockLang: {
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: 'lowercase',
  },
  codeBlockBody: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  codeBlockText: {
    fontSize: 13,
    lineHeight: 20,
  },
  codeTokenKeyword: {
    color: '#ff7b72',
  },
  codeTokenString: {
    color: '#a5d6ff',
  },
  codeTokenNumber: {
    color: '#ffa657',
  },
  codeTokenComment: {
    color: '#8b949e',
    fontStyle: 'italic',
  },
  codeTokenFunction: {
    color: '#d2a8ff',
  },
  tableContainer: {
    minWidth: 280,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  tableScroll: {
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableCell: {
    width: 140,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderCell: {
    paddingVertical: 7,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tableCellText: {
    fontSize: 13,
    lineHeight: 18,
  },
})
