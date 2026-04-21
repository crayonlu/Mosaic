import { MoodHeatMap } from '@/components/archive/MoodHeatMap'
import { MemoInput } from '@/components/editor/MemoInput'
import { MemoList } from '@/components/memo/MemoList'
import { toast } from '@/components/ui'
import { useConnection } from '@/hooks/useConnection'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useToastConfirm } from '@/hooks/useToastConfirm'
import { useCreateMemo, useDeleteMemo, useTriggerReplies } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import { type MemoWithResources } from '@mosaic/api'
import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { KeyboardStickyView } from 'react-native-keyboard-controller'

const TAB_BAR_HEIGHT = 54

export default function HomeScreen() {
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const { confirm } = useToastConfirm()
  const { mutateAsync: createMemo, isPending: isCreating } = useCreateMemo()
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useDeleteMemo()
  const { mutateAsync: triggerReplies } = useTriggerReplies()

  const isPending = isCreating || isDeleting

  const handleMemoPress = (memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleDelete = async (id: string) => {
    if (!canUseNetwork || isPending) return

    confirm('确定要删除这条 Memo 吗？', async () => {
      try {
        await deleteMemo(id)
        toast.success('成功', '已删除')
      } catch (error) {
        handleError(error)
        toast.error('错误', '删除失败')
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
      const newMemo = await createMemo({
        content: trimmedContent,
        tags,
        resourceIds: resources,
        aiSummary,
      })
      toast.success('成功', '已创建')
      triggerReplies(newMemo.id).catch(() => {})
    } catch (error) {
      handleError(error)
      toast.error('错误', '创建失败')
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

      <KeyboardStickyView offset={{ closed: 0, opened: TAB_BAR_HEIGHT }}>
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <MemoInput onSubmit={handleSubmit} disabled={!canUseNetwork || isPending} />
        </View>
      </KeyboardStickyView>
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
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
