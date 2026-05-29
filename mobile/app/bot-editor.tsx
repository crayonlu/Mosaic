import { SwitchBtn } from '@/components/ui'
import { pickAndCropAvatar } from '@/components/ui/AvatarCropper'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { toast } from '@/components/ui/Toast'
import { useAuthHeaders } from '@/hooks/useAuthHeaders'
import { SafeKeyboardAwareScrollView } from '@/lib/native/safeProviders'
import { useCreateBot, useDeleteBot, useUpdateBot } from '@/lib/query'
import { consumeOutbound, openDescriptionEditor } from '@/lib/transient/descriptionEditorBridge'
import { useThemeStore } from '@/stores/themeStore'
import { resourcesApi, type Bot } from '@mosaic/api'
import { Image } from 'expo-image'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Camera, ChevronRight, X } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

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

  // Pick up edits returned from the description editor route (if any).
  useFocusEffect(
    useCallback(() => {
      const next = consumeOutbound()
      if (next !== null) {
        setDescription(next)
      }
    }, [])
  )

  const handleOpenDescriptionEditor = () => {
    openDescriptionEditor(description)
    router.push('/bot-editor-description')
  }

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

      {/*
        Official-recommended pattern for forms with bottom-pinned button:
        - mode="layout" with flex: 1 + justifyContent: "space-between"
        - bottomOffset: distance between keyboard and focused input caret
        See: https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view
      */}
      <SafeKeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        bottomOffset={50}
        mode="layout"
      >
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
            onPress={handleOpenDescriptionEditor}
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

        {/* Delete button — pinned to bottom via flex space-between */}
        {bot && (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: theme.error }]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            <Text style={[styles.deleteBtnText, { color: theme.error }]}>{t('bot.delete')}</Text>
          </TouchableOpacity>
        )}
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
  body: {
    flexGrow: 1,
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
})
