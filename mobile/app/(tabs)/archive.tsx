/**
 * Archive Tab - History & Timeline View
 */

import { useThemeStore } from '@/stores/theme-store'
import { StyleSheet, View } from 'react-native'

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
