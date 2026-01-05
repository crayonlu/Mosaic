/**
 * Development Tools Page
 * Only visible in development mode
 */

import { resetDatabase } from '@/lib/database'
import { useThemeStore } from '@/stores/theme-store'
import { StyleSheet, View } from 'react-native'
import { Button } from '@/components/ui/Button'

export default function DevPage() {
  const { theme } = useThemeStore()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Button
        title="Reset Database"
        onPress={resetDatabase}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
})
