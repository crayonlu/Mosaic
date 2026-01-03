import { Colors } from '@/constants/colors'
import { useThemeStore } from '@/stores/theme-store'
import { StyleSheet, View, Text } from 'react-native'
import { WebView } from 'react-native-webview'

interface MarkdownRendererProps {
  content: string
  contentFormat?: 'plain' | 'html'
  style?: any
}

/**
 * MarkdownRenderer component
 * Renders memo content as HTML (from rich text editor) or plain text
 */
export function MarkdownRenderer({
  content,
  contentFormat = 'plain',
  style,
}: MarkdownRendererProps) {
  const { theme } = useThemeStore()

  // If content is empty, show nothing
  if (!content || content.trim().length === 0) {
    return null
  }

  // For plain text, render as simple text
  if (contentFormat === 'plain') {
    return (
      <View style={[styles.container, style]}>
        <Text style={[styles.text, { color: theme.text }]}>{content}</Text>
      </View>
    )
  }

  // For HTML content, render using WebView with styled HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: ${theme.text};
            background-color: ${theme.background};
            padding: 12px;
          }
          p {
            margin-bottom: 12px;
          }
          h1, h2, h3, h4, h5, h6 {
            margin-top: 16px;
            margin-bottom: 8px;
            font-weight: 600;
          }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; }
          h3 { font-size: 18px; }
          ul, ol {
            margin-left: 20px;
            margin-bottom: 12px;
          }
          li {
            margin-bottom: 4px;
          }
          blockquote {
            border-left: 3px solid ${theme.border};
            padding-left: 12px;
            margin: 12px 0;
            color: ${theme.textSecondary};
          }
          code {
            background-color: ${theme.border};
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
          }
          pre {
            background-color: ${theme.border};
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 12px 0;
          }
          pre code {
            background-color: transparent;
            padding: 0;
          }
          a {
            color: ${Colors.primary.DEFAULT};
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          strong {
            font-weight: 600;
          }
          em {
            font-style: italic;
          }
          mark {
            background-color: ${Colors.warning};
            padding: 2px 4px;
            border-radius: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
          }
          th, td {
            border: 1px solid ${theme.border};
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: ${theme.border};
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `

  return (
    <View style={[styles.container, styles.webViewContainer, style]}>
      <WebView
        source={{ html: htmlContent }}
        style={[styles.webView, { backgroundColor: theme.background }]}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  webViewContainer: {
    minHeight: 100,
  },
  webView: {
    flex: 1,
  },
})
