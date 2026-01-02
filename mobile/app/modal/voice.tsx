/**
 * Voice Recording Modal
 * Bottom sheet for voice recording
 */

import { View, StyleSheet, TouchableOpacity, Text } from 'react-native'
import { useThemeStore } from '@/stores/theme-store'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Spacing, BorderRadius, Shadows, Typography } from '@/constants/theme'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function VoiceModal() {
  const { theme } = useThemeStore()

  const handleClose = () => {
    router.back()
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={[styles.content, { backgroundColor: theme.background }]} edges={['bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: theme.textSecondary }]}>取消</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>语音录制</Text>
          <TouchableOpacity style={styles.headerButton}>
            <Text style={[styles.headerButtonText, styles.saveButton, { color: theme.primaryDark }]}>完成</Text>
          </TouchableOpacity>
        </View>

        {/* Recording UI */}
        <View style={styles.recordingContainer}>
          {/* TODO: Add recording visualization and controls */}
          <View style={[styles.recordButton, { backgroundColor: theme.surface, ...Shadows.md }]}>
            <Ionicons name="mic" size={48} color="#EF4444" />
          </View>
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>点击开始录制</Text>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    minHeight: 300,
    ...Shadows.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: Spacing.sm,
    minWidth: 50,
  },
  headerButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: '500' as const,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '600' as const,
  },
  saveButton: {
    fontWeight: '600' as const,
    textAlign: 'right',
  },
  recordingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    marginTop: Spacing.lg,
    fontSize: Typography.fontSize.base,
  },
})
