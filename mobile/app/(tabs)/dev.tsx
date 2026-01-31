/**
 * Development Tools Page
 * Only visible in development mode
 */

import { Button, toast } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { StyleSheet, Text, View } from 'react-native'

export default function DevPage() {
  const { theme } = useThemeStore()
  const { serverUrl, user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('成功', '已退出登录')
    } catch (error) {
      console.error('[DevPage] Logout error:', error)
      toast.error('错误', '退出失败')
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>开发工具</Text>
      <Text style={[styles.info, { color: theme.textSecondary }]}>
        服务器: {serverUrl || '未配置'}
      </Text>
      <Text style={[styles.info, { color: theme.textSecondary }]}>
        用户: {user?.username || '未登录'}
      </Text>
      <View style={styles.buttonContainer}>
        <Button title="退出登录" variant="danger" onPress={handleLogout} />
      </View>
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
  info: {
    fontSize: 14,
    marginBottom: 8,
  },
  buttonContainer: {
    marginTop: 20,
  },
})
