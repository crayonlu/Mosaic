/**
 * Development Tools Page
 * Only visible in development mode
 */

import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { useDatabaseStore } from '@/stores/database-store'
import { useThemeStore } from '@/stores/theme-store'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

export default function DevPage() {
  const { theme } = useThemeStore()
  const { resetDatabase } = useDatabaseStore()
  const [isResetting, setIsResetting] = useState(false)

  const handleResetDatabase = async () => {
    if (isResetting) return

    try {
      setIsResetting(true)
      console.log('[DevPage] Starting database reset...')

      // Reset database
      await resetDatabase()

      console.log('[DevPage] Database reset complete')
      toast.success('成功', '数据库已重置')
    } catch (error) {
      console.error('[DevPage] Failed to reset database:', error)
      toast.error('错误', '重置数据库失败')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>开发工具</Text>
      <Button
        title={isResetting ? '重置中...' : '重置数据库'}
        onPress={handleResetDatabase}
        disabled={isResetting}
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
