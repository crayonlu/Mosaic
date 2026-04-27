import { CoverImagePicker } from '@/components/archive/CoverImagePicker'
import { MemoCard } from '@/components/memo/MemoCard'
import { Loading } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useDiary, useUpdateDiary } from '@/lib/query'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { useThemeStore } from '@/stores/themeStore'
import type { MemoWithResources, Resource } from '@mosaic/api'
import { resourcesApi } from '@mosaic/api'
import { Image } from 'expo-image'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

export interface DayPageViewRef {
  hasChanges: boolean
  isPending: boolean
  hasDiary: boolean
  save: () => Promise<void>
  cancel: () => void
}

interface DayPageViewProps {
  date: string
  onMemoPress?: (memoId: string) => void
  isEditing: boolean
}

export const DayPageView = forwardRef<DayPageViewRef, DayPageViewProps>(function DayPageView(
  { date, onMemoPress, isEditing },
  ref
) {
  const { theme } = useThemeStore()
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})
  const [summaryDraft, setSummaryDraft] = useState('')
  const [coverImageIdDraft, setCoverImageIdDraft] = useState<string | undefined>(undefined)

  const { data: diary, isLoading } = useDiary(date)
  const updateDiary = useUpdateDiary()
  const archivedMemos = useMemo<MemoWithResources[]>(() => diary?.memos ?? [], [diary?.memos])

  useEffect(() => {
    getBearerAuthHeaders().then(setAuthHeaders)
  }, [])

  useEffect(() => {
    if (!isEditing) {
      setSummaryDraft(diary?.summary ?? '')
      setCoverImageIdDraft(diary?.coverImageId)
    }
  }, [diary?.summary, diary?.coverImageId, isEditing])

  useEffect(() => {
    setSummaryDraft(diary?.summary ?? '')
    setCoverImageIdDraft(diary?.coverImageId)
    // Reset drafts on date change regardless of edit state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const hasChanges =
    summaryDraft.trim() !== (diary?.summary ?? '').trim() ||
    (coverImageIdDraft ?? null) !== (diary?.coverImageId ?? null)

  const handleSave = useCallback(async () => {
    if (!diary) return
    try {
      await updateDiary.mutateAsync({
        date,
        data: {
          summary: summaryDraft.trim(),
          coverImageId: coverImageIdDraft ?? null,
        },
      })
    } catch (error) {
      console.error('更新日记失败:', error)
      toast.error('保存失败')
    }
  }, [diary, date, summaryDraft, coverImageIdDraft, updateDiary])

  const handleCancel = useCallback(() => {
    setSummaryDraft(diary?.summary ?? '')
    setCoverImageIdDraft(diary?.coverImageId)
  }, [diary?.summary, diary?.coverImageId])

  useImperativeHandle(
    ref,
    () => ({
      hasChanges,
      isPending: updateDiary.isPending,
      hasDiary: !!diary,
      save: handleSave,
      cancel: handleCancel,
    }),
    [hasChanges, updateDiary.isPending, diary, handleSave, handleCancel]
  )

  const handleMemoPress = useCallback(
    (memoId: string) => {
      onMemoPress?.(memoId)
    },
    [onMemoPress]
  )

  const displayCoverImageId = isEditing ? coverImageIdDraft : diary?.coverImageId
  const coverResource = useMemo(
    () =>
      archivedMemos
        .flatMap((memo: MemoWithResources) => memo.resources as Resource[])
        .find((resource: Resource) => resource.id === displayCoverImageId),
    [archivedMemos, displayCoverImageId]
  )

  const coverImageUrl = useMemo(() => {
    if (!displayCoverImageId) return undefined
    if (coverResource?.resourceType === 'video') {
      return resourcesApi.getThumbnailUrl(displayCoverImageId)
    }
    if (coverResource) {
      return resourcesApi.getDownloadUrl(coverResource.id)
    }
    return resourcesApi.getDownloadUrl(displayCoverImageId)
  }, [coverResource, displayCoverImageId])

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <Loading text="加载中..." />
      </View>
    )
  }

  if (!diary) {
    return (
      <View style={styles.centeredContainer}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{date} 日记不存在</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {coverImageUrl && (
        <View style={styles.coverCard}>
          <Image
            source={{ uri: coverImageUrl, headers: authHeaders }}
            style={styles.coverImage}
            contentFit="cover"
          />
        </View>
      )}

      {(diary.summary || isEditing) && (
        <View style={[styles.card, { borderRadius: theme.radius.medium }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>今日总结</Text>
          {isEditing ? (
            <TextInput
              value={summaryDraft}
              onChangeText={setSummaryDraft}
              placeholder="写下今天的心情或总结..."
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
              style={[
                styles.summaryInput,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  borderRadius: theme.radius.medium,
                },
              ]}
            />
          ) : (
            <Text style={[styles.summaryText, { color: theme.text }]}>{diary.summary}</Text>
          )}
        </View>
      )}

      {isEditing && (
        <View style={styles.coverPickerSection}>
          <CoverImagePicker
            memos={archivedMemos}
            selectedCoverId={coverImageIdDraft}
            onSelect={setCoverImageIdDraft}
            onClear={() => setCoverImageIdDraft(undefined)}
          />
        </View>
      )}

      <View style={styles.memosSection}>
        {archivedMemos.length > 0 ? (
          <View style={styles.memosList}>
            {archivedMemos.map(memo => (
              <MemoCard
                key={memo.id}
                memo={memo}
                onPress={isEditing ? undefined : () => handleMemoPress(memo.id)}
                showActions={false}
                showPressFeedback={false}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyArchiveCard}>
            <Text style={[styles.emptyArchiveText, { color: theme.textSecondary }]}>
              当天暂无已归档 Memo
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    padding: 12,
  },
  coverCard: {
    paddingHorizontal: 12,
  },
  coverImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
  },
  sectionLabel: {
    fontSize: 13,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryInput: {
    minHeight: 108,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  coverPickerSection: {
    paddingHorizontal: 8,
  },
  memosSection: {
    marginTop: 2,
    gap: 8,
  },
  memosList: {
    overflow: 'hidden',
  },
  emptyArchiveCard: {
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  emptyArchiveText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
  },
})
