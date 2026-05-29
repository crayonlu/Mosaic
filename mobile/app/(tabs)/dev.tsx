import { SwitchBtn } from '@/components/ui'
import { useDevStore } from '@/stores/devStore'
import { useThemeStore } from '@/stores/themeStore'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

export default function DevScreen() {
  const { theme } = useThemeStore()
  const showFps = useDevStore(s => s.showFps)
  const setShowFps = useDevStore(s => s.setShowFps)

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.section}>
        <Text style={[styles.title, { color: theme.text }]}>Dev Tools</Text>
      </View>

      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <View style={styles.rowLabel}>
          <Text style={[styles.label, { color: theme.text }]}>实时帧率</Text>
          <Text style={[styles.status, { color: theme.textSecondary }]}>
            在屏幕中央显示一个浮动 FPS 监视器
          </Text>
        </View>
        <SwitchBtn value={showFps} onValueChange={setShowFps} />
      </View>
    </ScrollView>
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
  rowLabel: {
    flex: 1,
    paddingRight: 12,
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
