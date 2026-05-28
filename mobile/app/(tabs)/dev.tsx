import { useThemeStore } from '@/stores/themeStore'
import { StyleSheet, Text, View } from 'react-native'

export default function DevScreen() {
  const { theme } = useThemeStore()
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.section}>
        <Text style={[styles.title, { color: theme.text }]}>Dev Tools</Text>
      </View>

      <View style={[styles.row, { borderBottomColor: theme.border }]}></View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  status: {
    fontSize: 13,
    marginTop: 2,
  },
})
