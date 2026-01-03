/**
 * Settings Tab - App Settings and Preferences
 */

import { useThemeStore } from '@/stores/theme-store'
import { StyleSheet, View } from 'react-native'
export default function SettingsScreen() {
  const { theme } = useThemeStore()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* TODO: Add settings sections */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
