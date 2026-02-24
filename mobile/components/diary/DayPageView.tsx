import { CoverImagePicker } from '@/components/archive/CoverImagePicker'
import { MemoCard } from '@/components/memo/MemoCard'
import { Loading } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import { useDiary, useUpdateDiary } from '@/lib/query'
import { getBearerAuthHeaders } from '@/lib/services/api-auth'
import { useThemeStore } from '@/stores/theme-store'
import { resourcesApi } from '@mosaic/api'
import { Image } from 'expo-image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

interface DayPageViewProps {
  date: string
  onMemoPress?: (memoId: string) => void
}

export function DayPageView({ date, onMemoPress }: DayPageViewProps) {
  const { theme } = useThemeStore()
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [coverImageIdDraft, setCoverImageIdDraft] = useState<string | undefined>(undefined)

  const { data: diary, isLoading } = useDiary(date)
  const updateDiary = useUpdateDiary()
  const archivedMemos = useMemo(() => diary?.memos ?? [], [diary?.memos])

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await getBearerAuthHeaders()
      setAuthHeaders(headers)
    }
    loadAuthHeaders()
  }, [])

  useEffect(() => {
    if (!isEditing) {
      setSummaryDraft(diary?.summary ?? '')
      setCoverImageIdDraft(diary?.coverImageId)
    }
  }, [diary?.summary, diary?.coverImageId, isEditing])

  useEffect(() => {
    setIsEditing(false)
  }, [date])

  const displayCoverImageId = isEditing ? coverImageIdDraft : diary?.coverImageId

  const coverImageUrl = useMemo(() => {
    if (!displayCoverImageId) return undefined
    return resourcesApi.getDownloadUrl(displayCoverImageId)
  }, [displayCoverImageId])

  const hasChanges =
    summaryDraft.trim() !== (diary?.summary ?? '').trim() ||
    (coverImageIdDraft ?? null) !== (diary?.coverImageId ?? null)

  const handleMemoPress = useCallback(
    (memoId: string) => {
      onMemoPress?.(memoId)
    },
    [onMemoPress]
  )

  const handleStartEdit = () => {
    setSummaryDraft(diary?.summary ?? '')
    setCoverImageIdDraft(diary?.coverImageId)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setSummaryDraft(diary?.summary ?? '')
    setCoverImageIdDraft(diary?.coverImageId)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!diary) return
    try {
      await updateDiary.mutateAsync({
        date,
        data: {
          summary: summaryDraft.trim(),
          coverImageId: coverImageIdDraft ?? null,
        },
      })
      toast.success('保存成功')
      setIsEditing(false)
    } catch (error) {
      console.error('更新日记失败:', error)
      toast.error('保存失败')
    }
  }

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
      <View style={styles.editActionsRow}>
        {!isEditing ? (
          <Pressable
            style={[styles.editActionButton, { backgroundColor: `${theme.primary}12` }]}
            onPress={handleStartEdit}
          >
            <Text style={[styles.editActionText, { color: theme.primary }]}>编辑</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.actionTextButton} onPress={handleCancelEdit}>
              <Text style={[styles.actionText, { color: theme.textSecondary }]}>取消</Text>
            </Pressable>
            <Pressable
              style={styles.actionTextButton}
              onPress={handleSave}
              disabled={!hasChanges || updateDiary.isPending}
            >
              <Text
                style={[
                  styles.actionText,
                  {
                    color:
                      !hasChanges || updateDiary.isPending ? theme.textSecondary : theme.primary,
                  },
                ]}
              >
                {updateDiary.isPending ? '保存中...' : '保存'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

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
        <View style={[styles.card, { borderColor: theme.border }]}>
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
                  borderColor: theme.border,
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
          <View style={[styles.memosList]}>
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
          <View style={[styles.emptyArchiveCard]}>
            <Text style={[styles.emptyArchiveText, { color: theme.textSecondary }]}>
              当天暂无已归档 Memo
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

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
  editActionsRow: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  coverPickerSection: {
    paddingHorizontal: 8,
  },
  // Compact mood display styles
  moodDisplay: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodIntensity: {
    fontSize: 18,
    fontWeight: '700',
  },
  memosSection: {
    marginTop: 2,
    gap: 8,
  },
  memosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  memoCount: {
    fontSize: 13,
    fontWeight: '500',
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
