/**
 * Home Tab - Main Memos Page
 * Displays today's memos with a floating action button
 */

import { View, StyleSheet } from 'react-native'
import { useThemeStore } from '@/stores/theme-store'
import { Spacing } from '@/constants/theme'

export default function HomeScreen() {
  const { theme } = useThemeStore()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        {/* TODO: Add header content */}
      </View>

      {/* Memo List */}
      <View style={styles.content}>
        {/* TODO: Add MemoList component */}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
})
