/**
 * Archive Tab - History & Timeline View
 */

import { View, StyleSheet } from 'react-native'
import { useThemeStore } from '@/stores/theme-store'

export default function ArchiveScreen() {
  const { theme } = useThemeStore()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* TODO: Add TimelineView component */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
