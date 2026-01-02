/**
 * Search Tab - Search and Filter Memos
 */

import { View, StyleSheet } from 'react-native'
import { useThemeStore } from '@/stores/theme-store'

export default function SearchScreen() {
  const { theme } = useThemeStore()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* TODO: Add search input and results */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
