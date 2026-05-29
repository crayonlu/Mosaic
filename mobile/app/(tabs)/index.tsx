import { MoodHeatMap } from '@/components/archive/MoodHeatMap'
import { MemoInput } from '@/components/editor/MemoInput'
import { MemoList } from '@/components/memo/MemoList'
import { toast } from '@/components/ui'
import { useConnection } from '@/hooks/useConnection'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useToastConfirm } from '@/hooks/useToastConfirm'
import { SafeKeyboardStickyView } from '@/lib/native/safeProviders'
import { useCreateMemo, useDeleteMemo } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import { type MemoWithResources } from '@mosaic/api'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TAB_BAR_HEIGHT = 54

export default function HomeScreen() {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const { confirm } = useToastConfirm()
  const { mutateAsync: createMemo, isPending: isCreating } = useCreateMemo()
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useDeleteMemo()
  const [inputFocused, setInputFocused] = useState(false)
  const insets = useSafeAreaInsets()

  const isPending = isCreating || isDeleting

  const handleMemoPress = (memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleDelete = async (id: string) => {
    if (!canUseNetwork || isPending) return

    confirm(t('memo.deleteConfirm'), async () => {
      try {
        await deleteMemo(id)
      } catch (error) {
        handleError(error)
        toast.error(t('common.error'), t('memo.deleteFailed'))
      }
    })
  }

  const handleSubmit = async (
    content: string,
    tags: string[],
    resources: string[],
    aiSummary?: string
  ) => {
    const trimmedContent = content.trim()
    if ((!trimmedContent && resources.length === 0) || !canUseNetwork || isPending) {
      return
    }

    try {
      await createMemo({
        content: trimmedContent,
        tags,
        resourceIds: resources,
        aiSummary,
      })
    } catch (error) {
      handleError(error)
      toast.error(t('common.error'), t('memo.createFailed'))
    }
  }

  const handleDateClick = (date: string) => {
    router.push({ pathname: '/diaries', params: { date } })
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.listContainer}>
        <MemoList
          onMemoPress={handleMemoPress}
          onMemoDelete={handleDelete}
          headerComponent={
            <View style={styles.heatMapSection}>
              <MoodHeatMap onDateClick={handleDateClick} />
            </View>
          }
        />
      </View>

      <SafeKeyboardStickyView offset={{ closed: 0, opened: TAB_BAR_HEIGHT + insets.bottom }}>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.background,
              borderColor: inputFocused ? theme.border : 'transparent',
              borderTopLeftRadius: inputFocused ? 12 : 0,
              borderTopRightRadius: inputFocused ? 12 : 0,
              paddingVertical: inputFocused ? 12 : 8,
            },
          ]}
        >
          <MemoInput
            onSubmit={handleSubmit}
            onFocusChange={setInputFocused}
            disabled={!canUseNetwork || isPending}
          />
        </View>
      </SafeKeyboardStickyView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  heatMapSection: {},
  sectionHeader: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    paddingHorizontal: 12,
    borderWidth: 1,
  },
})
