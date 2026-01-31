import { Button } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { Moon, Sun, User } from 'lucide-react-native'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function SettingsScreen() {
  const { theme, mode, setMode } = useThemeStore()
  const { user, serverUrl, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
  }

  const toggleTheme = () => {
    setMode(mode === 'light' ? 'dark' : 'light')
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>账户</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <User size={24} color="#FFFFFF" />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: theme.text }]}>
                {user?.username || '未登录'}
              </Text>
              <Text style={[styles.serverUrl, { color: theme.textSecondary }]}>
                {serverUrl || '未配置服务器'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>外观</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
            {mode === 'light' ? (
              <Sun size={20} color={theme.text} />
            ) : (
              <Moon size={20} color={theme.text} />
            )}
            <Text style={[styles.menuItemText, { color: theme.text }]}>
              {mode === 'light' ? '浅色模式' : '深色模式'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Button title="退出登录" variant="danger" onPress={handleLogout} fullWidth />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: theme.textSecondary }]}>Mosaic v1.0.0</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.7,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  serverUrl: {
    fontSize: 13,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  version: {
    fontSize: 12,
  },
})
