import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { consumeInbound, setOutbound } from '@/lib/transient/descriptionEditorBridge'
import { SafeKeyboardAwareScrollView } from '@/lib/native/safeProviders'
import { useThemeStore } from '@/stores/themeStore'
import { router } from 'expo-router'
import { X } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

export default function BotEditorDescriptionScreen() {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const [text, setText] = useState(() => consumeInbound() ?? '')

  const handleSave = () => {
    setOutbound(text)
    router.back()
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={t('bot.personalityDesc')}
        left={
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
            <X size={22} color={theme.textSecondary} />
          </Pressable>
        }
        right={
          <Pressable onPress={handleSave} hitSlop={12} style={{ padding: 4 }}>
            <Text style={[styles.saveBtn, { color: theme.primary }]}>{t('bot.save')}</Text>
          </Pressable>
        }
      />

      <SafeKeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        mode="insets"
        bottomOffset={50}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={text}
          onChangeText={setText}
          placeholder={t('bot.descPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          multiline
          textAlignVertical="top"
          autoFocus
        />
      </SafeKeyboardAwareScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  saveBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    textAlignVertical: 'top',
    minHeight: 300,
  },
})
