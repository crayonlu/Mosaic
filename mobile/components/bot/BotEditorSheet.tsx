import { SwitchBtn } from '@/components/ui'
import { pickAndCropAvatar } from '@/components/ui/AvatarCropper'
import { toast } from '@/components/ui/Toast'
import { useAuthHeaders } from '@/hooks/useAuthHeaders'
import { SafeKeyboardAvoidingView } from '@/lib/native/safeProviders'
import { useCreateBot, useDeleteBot, useUpdateBot } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import { resourcesApi, type Bot } from '@mosaic/api'
import { Image } from 'expo-image'
import { Camera, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface BotEditorSheetProps {
  visible: boolean
  bot?: Bot
  onClose: () => void
}

export function BotEditorSheet({ visible, bot, onClose }: BotEditorSheetProps) {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const { headers: authHeaders } = useAuthHeaders()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [autoReply, setAutoReply] = useState(true)
  const [model, setModel] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const bottomInset = insets.bottom + 16

  const { mutateAsync: createBot, isPending: isCreating } = useCreateBot()
  const { mutateAsync: updateBot, isPending: isUpdating } = useUpdateBot()
  const { mutateAsync: deleteBot, isPending: isDeleting } = useDeleteBot()

  const isPending = isCreating || isUpdating || isDeleting

  useEffect(() => {
    if (visible) {
      setName(bot?.name ?? '')
      setDescription(bot?.description ?? '')
      setTagsInput(bot?.tags.join(' ') ?? '')
      setAutoReply(bot?.autoReply ?? true)
      setModel(bot?.model ?? '')
      setAvatarUrl(bot?.avatarUrl)
    }
  }, [visible, bot])

  const parsedTags = tagsInput
    .split(/[\s,，]+/)
    .map(t => t.replace(/^#/, '').trim())
    .filter(Boolean)

  const handleAvatarPress = async () => {
    const uri = await pickAndCropAvatar()
    if (!uri) return
    setUploadingAvatar(true)
    try {
      const resource = await resourcesApi.upload({
        uri,
        name: 'bot-avatar.jpg',
        type: 'image/jpeg',
      })
      setAvatarUrl(resourcesApi.getDownloadUrl(resource.id))
    } catch {
      toast.error(t('bot.avatarUploadFailed'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.show({
        type: 'warning',
        title: t('bot.nameRequired'),
        message: t('bot.nameRequiredMsg'),
      })
      return
    }

    try {
      if (bot) {
        await updateBot({
          id: bot.id,
          data: {
            name: name.trim(),
            description: description.trim(),
            tags: parsedTags,
            autoReply,
            avatarUrl,
            model: model.trim() || undefined,
          },
        })
      } else {
        await createBot({
          name: name.trim(),
          description: description.trim(),
          tags: parsedTags,
          autoReply,
          avatarUrl,
          model: model.trim() || undefined,
        })
      }
      onClose()
    } catch {
      toast.error(t('bot.saveFailed'))
    }
  }

  const handleDelete = () => {
    if (!bot) return
    toast.show({
      type: 'warning',
      title: t('bot.deleteConfirm'),
      message: t('bot.deleteConfirmMsg', { name: bot.name }),
      actionLabel: t('common.delete'),
      duration: 10000,
      onAction: async () => {
        try {
          await deleteBot(bot.id)
          onClose()
        } catch {
          toast.error(t('bot.deleteFailed'))
        }
      },
    })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="transparent" translucent barStyle="dark-content" />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View
          style={[styles.header, { borderBottomColor: theme.border, paddingTop: insets.top + 14 }]}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {bot ? t('bot.editBot') : t('bot.newBot')}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isPending} hitSlop={12}>
            <Text
              style={[styles.saveBtn, { color: isPending ? theme.textSecondary : theme.primary }]}
            >
              {isPending ? t('bot.saving') : t('bot.save')}
            </Text>
          </TouchableOpacity>
        </View>

        <SafeKeyboardAvoidingView style={styles.bodyKeyboard} behavior="padding">
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={[styles.body, { paddingBottom: bottomInset }]}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={styles.avatarRow}
              onPress={handleAvatarPress}
              disabled={uploadingAvatar}
              activeOpacity={0.75}
            >
              <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                ) : avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl, headers: authHeaders }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Camera size={22} color={theme.onPrimary} />
                    <Text style={[styles.avatarPlaceholderText, { color: theme.onPrimary }]}>
                      {name.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>
                {avatarUrl ? t('bot.changeAvatar') : t('bot.uploadAvatar')}
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.section,
                { backgroundColor: theme.surface, borderRadius: theme.radius.medium },
              ]}
            >
              <View style={[styles.field, { borderBottomColor: theme.border }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t('bot.name')}</Text>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('bot.namePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={50}
                />
              </View>

              <View style={[styles.field, { borderBottomColor: theme.border }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t('bot.tags')}</Text>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={tagsInput}
                  onChangeText={setTagsInput}
                  placeholder={t('bot.tagsPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.fieldRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  {t('bot.autoReply')}
                </Text>
                <SwitchBtn value={autoReply} onValueChange={setAutoReply} />
              </View>

              <View style={[styles.field, { borderBottomColor: theme.border }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t('bot.model')}</Text>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={model}
                  onChangeText={setModel}
                  placeholder={t('bot.modelPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={50}
                />
              </View>
            </View>

            <View
              style={[
                styles.section,
                { backgroundColor: theme.surface, borderRadius: theme.radius.medium },
              ]}
            >
              <Text style={[styles.label, styles.descLabel, { color: theme.textSecondary }]}>
                {t('bot.personalityDesc')}
              </Text>
              <TextInput
                style={[styles.descInput, { color: theme.text, borderColor: theme.border }]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('bot.descPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </View>

            {bot && (
              <View
                style={[
                  styles.section,
                  { backgroundColor: theme.surface, borderRadius: theme.radius.medium },
                ]}
              >
                <TouchableOpacity
                  style={[styles.deleteBtn, { borderColor: theme.error }]}
                  onPress={handleDelete}
                  disabled={isDeleting}
                >
                  <Text style={[styles.deleteBtnText, { color: theme.error }]}>
                    {t('bot.delete')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeKeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    padding: 16,
    gap: 12,
  },
  bodyKeyboard: {
    flex: 1,
  },
  bodyScroll: {
    flex: 1,
  },
  avatarRow: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    gap: 2,
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  avatarHint: {
    fontSize: 12,
  },
  section: {
    overflow: 'hidden',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  switchCopy: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontSize: 14,
    minWidth: 60,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  descLabel: {
    padding: 14,
    paddingBottom: 4,
  },
  descInput: {
    fontSize: 14,
    lineHeight: 22,
    minHeight: 160,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 10,
    marginTop: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  deleteBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
