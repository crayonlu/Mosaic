import { SwitchBtn } from '@/components/ui'
import { pickAndCropAvatar } from '@/components/ui/AvatarCropper'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { toast } from '@/components/ui/Toast'
import { useAuthHeaders } from '@/hooks/useAuthHeaders'
import { SafeKeyboardAwareScrollView } from '@/lib/native/safeProviders'
import { useCreateBot, useDeleteBot, useUpdateBot } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import { resourcesApi, type Bot } from '@mosaic/api'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { Camera, ChevronRight, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function BotEditorScreen() {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const { headers: authHeaders } = useAuthHeaders()
  const params = useLocalSearchParams<{ bot?: string }>()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [autoReply, setAutoReply] = useState(true)
  const [model, setModel] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [descEditorVisible, setDescEditorVisible] = useState(false)

  const { mutateAsync: createBot, isPending: isCreating } = useCreateBot()
  const { mutateAsync: updateBot, isPending: isUpdating } = useUpdateBot()
  const { mutateAsync: deleteBot, isPending: isDeleting } = useDeleteBot()

  const isPending = isCreating || isUpdating || isDeleting

  const bot: Bot | undefined = params.bot ? JSON.parse(params.bot) : undefined

  useEffect(() => {
    setName(bot?.name ?? '')
    setDescription(bot?.description ?? '')
    setTagsInput(bot?.tags.join(' ') ?? '')
    setAutoReply(bot?.autoReply ?? true)
    setModel(bot?.model ?? '')
    setAvatarUrl(bot?.avatarUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      router.back()
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
          router.back()
        } catch {
          toast.error(t('bot.deleteFailed'))
        }
      },
    })
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={bot ? t('bot.editBot') : t('bot.newBot')}
        left={
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
            <X size={22} color={theme.textSecondary} />
          </Pressable>
        }
        right={
          <Pressable onPress={handleSave} disabled={isPending} hitSlop={12} style={{ padding: 4 }}>
            <Text
              style={[styles.saveBtn, { color: isPending ? theme.textSecondary : theme.primary }]}
            >
              {isPending ? t('bot.saving') : t('bot.save')}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.body}>
        {/* Avatar */}
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

        {/* Form fields */}
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

          <View style={styles.fieldRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('bot.autoReply')}</Text>
            <SwitchBtn value={autoReply} onValueChange={setAutoReply} />
          </View>
        </View>

        {/* Description — header row taps to edit, preview scrolls independently */}
        <View
          style={[
            styles.section,
            styles.descSection,
            styles.descSectionFlex,
            { backgroundColor: theme.surface, borderRadius: theme.radius.medium },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setDescEditorVisible(true)}
            style={styles.descHeader}
          >
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              {t('bot.personalityDesc')}
            </Text>
            <ChevronRight size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          {description ? (
            <ScrollView style={styles.descPreviewScroll} nestedScrollEnabled>
              <Text style={[styles.descPreviewText, { color: theme.text }]}>{description}</Text>
            </ScrollView>
          ) : (
            <Text style={[styles.descPlaceholder, { color: theme.textSecondary }]}>
              {t('bot.descPlaceholder')}
            </Text>
          )}
        </View>

        {/* Delete button — pinned to bottom */}
        {bot && (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: theme.error }]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            <Text style={[styles.deleteBtnText, { color: theme.error }]}>{t('bot.delete')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Fullscreen description editor modal */}
      <DescriptionEditorModal
        visible={descEditorVisible}
        value={description}
        onSave={val => {
          setDescription(val)
          setDescEditorVisible(false)
        }}
        onClose={() => setDescEditorVisible(false)}
      />
    </View>
  )
}

/** Fullscreen text editor for bot description */
function DescriptionEditorModal({
  visible,
  value,
  onSave,
  onClose,
}: {
  visible: boolean
  value: string
  onSave: (text: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const [text, setText] = useState(value)

  useEffect(() => {
    if (visible) setText(value)
  }, [visible, value])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="transparent" translucent barStyle="dark-content" />
      <View
        style={[
          styles.modalContainer,
          { backgroundColor: theme.background, paddingTop: insets.top },
        ]}
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.textSecondary} />
          </Pressable>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{t('bot.personalityDesc')}</Text>
          <Pressable onPress={() => onSave(text)} hitSlop={12}>
            <Text style={[styles.saveBtn, { color: theme.primary }]}>{t('bot.save')}</Text>
          </Pressable>
        </View>
        <SafeKeyboardAwareScrollView
          style={styles.modalScrollView}
          contentContainerStyle={styles.modalScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={[styles.modalInput, { color: theme.text }]}
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
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  saveBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    padding: 16,
    gap: 12,
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
  label: {
    fontSize: 14,
    minWidth: 60,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  descSection: {
    padding: 14,
    gap: 8,
  },
  descSectionFlex: {
    flex: 1,
  },
  descHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  descPreviewScroll: {
    flex: 1,
  },
  descPreviewText: {
    fontSize: 13,
    lineHeight: 20,
  },
  descPlaceholder: {
    fontSize: 13,
    lineHeight: 20,
  },
  deleteBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalInput: {
    fontSize: 15,
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    textAlignVertical: 'top',
    minHeight: 300,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
})
