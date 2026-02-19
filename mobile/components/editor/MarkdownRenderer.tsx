import { useThemeStore } from '@/stores/theme-store'
import { StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'

interface MarkdownRendererProps {
  content: string
  style?: object
}

export function MarkdownRenderer({ content, style }: MarkdownRendererProps) {
  const { theme } = useThemeStore()

  if (!content || content.trim().length === 0) {
    return null
  }

  const isHtml = isHtmlContent(content)

  if (isHtml) {
    return <HtmlRenderer content={content} theme={theme} style={style} />
  }

  return <MarkdownContent content={content} theme={theme} style={style} />
}

function isHtmlContent(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith('<') && trimmed.endsWith('>') && /<[a-z][\s\S]*>/i.test(trimmed)
}

function HtmlRenderer({
  content,
  theme,
  style,
}: {
  content: string
  theme: {
    text: string
    background: string
    border: string
    primary: string
    textSecondary: string
  }
  style?: object
}) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: ${theme.text};
            background-color: ${theme.background};
            padding: 0;
            margin: 0;
          }
          p { margin-bottom: 8px; }
          strong { font-weight: 600; }
          em { font-style: italic; }
          a { color: ${theme.primary}; }
          code {
            background-color: ${theme.border};
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
          }
          pre {
            background-color: ${theme.border};
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
          }
          blockquote {
            border-left: 3px solid ${theme.border};
            padding-left: 12px;
            color: ${theme.textSecondary};
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `

  if (!content || content.trim().length === 0) {
    return null
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html: htmlContent }}
        style={[styles.webView, { backgroundColor: theme.background }]}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={false}
      />
    </View>
  )
}

function MarkdownContent({
  content,
  theme,
  style,
}: {
  content: string
  theme: { text: string; primary: string; textSecondary: string }
  style?: object
}) {
  const renderContent = () => {
    const lines = content.split('\n')
    return lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return (
          <Text key={index} style={[styles.h1, { color: theme.text }]}>
            {line.substring(2)}
          </Text>
        )
      }
      if (line.startsWith('## ')) {
        return (
          <Text key={index} style={[styles.h2, { color: theme.text }]}>
            {line.substring(3)}
          </Text>
        )
      }
      if (line.startsWith('### ')) {
        return (
          <Text key={index} style={[styles.h3, { color: theme.text }]}>
            {line.substring(4)}
          </Text>
        )
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <Text key={index} style={[styles.listItem, { color: theme.text }]}>
            {'\u2022'} {line.substring(2)}
          </Text>
        )
      }
      if (/^\d+\.\s/.test(line)) {
        const match = line.match(/^(\d+\.\s)(.*)$/)
        if (match) {
          return (
            <Text key={index} style={[styles.listItem, { color: theme.text }]}>
              {match[1]} {match[2]}
            </Text>
          )
        }
      }

      const renderedLine = renderInlineStyles(line, theme)
      return (
        <Text key={index} style={[styles.paragraph, { color: theme.text }]}>
          {renderedLine}
        </Text>
      )
    })
  }

  return <View style={[styles.container, style]}>{renderContent()}</View>
}

function renderInlineStyles(
  text: string,
  theme: { primary: string; text: string; textSecondary: string }
) {
  let result: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const italicMatch = remaining.match(/\*(.+?)\*/)
    const codeMatch = remaining.match(/`(.+?)`/)
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/)

    const matches = [
      boldMatch
        ? {
            type: 'bold',
            index: boldMatch.index!,
            length: boldMatch[0].length,
            content: boldMatch[1],
          }
        : null,
      italicMatch
        ? {
            type: 'italic',
            index: italicMatch.index!,
            length: italicMatch[0].length,
            content: italicMatch[1],
          }
        : null,
      codeMatch
        ? {
            type: 'code',
            index: codeMatch.index!,
            length: codeMatch[0].length,
            content: codeMatch[1],
          }
        : null,
      linkMatch
        ? {
            type: 'link',
            index: linkMatch.index!,
            length: linkMatch[0].length,
            text: linkMatch[1],
            url: linkMatch[2],
          }
        : null,
    ]
      .filter(Boolean)
      .sort((a, b) => a!.index - b!.index)

    if (matches.length === 0) {
      result.push(<Text key={key++}>{remaining}</Text>)
      break
    }

    const match = matches[0]!

    if (match.index > 0) {
      result.push(<Text key={key++}>{remaining.substring(0, match.index)}</Text>)
    }

    switch (match.type) {
      case 'bold':
        result.push(
          <Text key={key++} style={styles.bold}>
            {match.content}
          </Text>
        )
        break
      case 'italic':
        result.push(
          <Text key={key++} style={styles.italic}>
            {match.content}
          </Text>
        )
        break
      case 'code':
        result.push(
          <Text key={key++} style={[styles.code, { backgroundColor: theme.textSecondary + '20' }]}>
            {match.content}
          </Text>
        )
        break
      case 'link':
        result.push(
          <Text key={key++} style={[styles.link, { color: theme.primary }]}>
            {match.text}
          </Text>
        )
        break
    }

    remaining = remaining.substring(match.index + match.length)
  }

  return result
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 6,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  listItem: {
    fontSize: 16,
    lineHeight: 24,
    marginLeft: 16,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  link: {
    textDecorationLine: 'underline',
  },
})
