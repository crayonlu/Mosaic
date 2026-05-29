import { Button, Input } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { tokenStorage } from '@/lib/services/tokenStorage'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { authApi } from '@mosaic/api'
import { Lock } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ForceChangePassword() {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const clearMustChangePassword = useAuthStore(s => s.clearMustChangePassword)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error(t('changePassword.fillAll'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('changePassword.passwordMismatch'))
      return
    }
    if (newPassword.length < 8) {
      toast.error(t('changePassword.passwordTooShort'))
      return
    }

    setSaving(true)
    try {
      const tokens = await authApi.changePassword({
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim(),
      })
      await tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken)
      toast.success(t('changePassword.passwordChanged'))
      clearMustChangePassword()
    } catch {
      toast.error(t('changePassword.changeFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Lock size={32} color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{t('changePassword.forceTitle')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t('changePassword.forceSubtitle')}
        </Text>

        <View style={styles.form}>
          <Input
            placeholder={t('changePassword.oldPassword')}
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry
            autoComplete="password"
          />
          <Input
            placeholder={t('changePassword.newPassword')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <Input
            placeholder={t('changePassword.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <Button
            title={saving ? t('common.saving') : t('changePassword.submit')}
            onPress={handleSubmit}
            disabled={saving}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  form: {
    width: '100%',
    gap: 12,
  },
})
