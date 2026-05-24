import React, { type ErrorInfo, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[CrashDebug] ========== FATAL RENDER ERROR ==========')
    console.error('[CrashDebug] Message:', error.message)
    console.error('[CrashDebug] Name:', error.name)
    console.error('[CrashDebug] Stack:', error.stack)
    console.error('[CrashDebug] Component Stack:', errorInfo.componentStack)
    console.error('[CrashDebug] ========================================')
    this.setState({ errorInfo })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>💥 App Crashed</Text>
          <Text style={styles.subtitle}>Crash details logged to console</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.label}>Error:</Text>
            <Text style={styles.text}>{this.state.error?.message}</Text>
            {this.state.error?.name ? (
              <>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.text}>{this.state.error.name}</Text>
              </>
            ) : null}
            {this.state.error?.stack ? (
              <>
                <Text style={styles.label}>Stack:</Text>
                <Text style={styles.text}>{this.state.error.stack}</Text>
              </>
            ) : null}
            {this.state.errorInfo?.componentStack ? (
              <>
                <Text style={styles.label}>Component Tree:</Text>
                <Text style={styles.text}>{this.state.errorInfo.componentStack}</Text>
              </>
            ) : null}
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e94560',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 24,
  },
  scroll: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginTop: 14,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  text: {
    fontSize: 13,
    color: '#ddd',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
})
