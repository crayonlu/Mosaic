import { MemoInput } from '@/components/editor/MemoInput'
import { MemoList } from '@/components/memo/MemoList'
import { MoodHeatMap } from '@/components/archive/MoodHeatMap'
import { toast } from '@/components/ui'
import { useConnection } from '@/hooks/use-connection'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { useCreateMemo, useArchiveMemo, useDeleteMemo } from '@/lib/query'
import { useThemeStore } from '@/stores/theme-store'
import { type MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'

export default function HomeScreen() {
  const { theme } = useThemeStore()
  const { canUseNetwork } = useConnection()
  const handleError = useErrorHandler()
  const { mutateAsync: createMemo, isPending: isCreating } = useCreateMemo()
  const { mutateAsync: archiveMemo, isPending: isArchiving } = useArchiveMemo()
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useDeleteMemo()

  const isPending = isCreating || isArchiving || isDeleting

  const handleMemoPress = (memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleArchive = async (id: string) => {
    if (!canUseNetwork || isPending) return
    try {
      await archiveMemo(id)
      toast.success('成功', '已归档')
    } catch (error) {
      handleError(error)
      toast.error('错误', '归档失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!canUseNetwork || isPending) return
    try {
      await deleteMemo(id)
      toast.success('成功', '已删除')
    } catch (error) {
      handleError(error)
      toast.error('错误', '删除失败')
    }
  }

  const handleSubmit = async (content: string, tags: string[], resources: string[]) => {
    if (!content || content.trim().length === 0 || !canUseNetwork || isPending) {
      return
    }

    try {
      await createMemo({
        content: content.trim(),
        tags,
        resourceIds: resources,
      })
      toast.success('成功', '已创建')
    } catch (error) {
      handleError(error)
      toast.error('错误', '创建失败')
    }
  }

  const handleDateClick = (date: string) => {
    router.push({ pathname: '/diary/[date]', params: { date } })
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 44}
    >
      <View style={styles.listContainer}>
        <MemoList
          onMemoPress={handleMemoPress}
          onMemoArchive={handleArchive}
          onMemoDelete={handleDelete}
          headerComponent={
            <View style={styles.heatMapSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>情绪热力图</Text>
              </View>
              <MoodHeatMap onDateClick={handleDateClick} />
            </View>
          }
        />
      </View>

      <View style={[styles.inputContainer, { backgroundColor: theme.background }]}>
        <MemoInput onSubmit={handleSubmit} disabled={!canUseNetwork || isPending} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  heatMapSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
})
