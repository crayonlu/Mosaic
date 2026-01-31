import { MemoInput } from '@/components/editor/MemoInput'
import { MemoList } from '@/components/memo/MemoList'
import { toast } from '@/components/ui'
import { memosApi } from '@/lib/api'
import { useThemeStore } from '@/stores/theme-store'
import { type MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'

export default function HomeScreen() {
  const { theme } = useThemeStore()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleMemoPress = (memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleArchive = async (id: string) => {
    try {
      await memosApi.archive(id)
      setRefreshTrigger(prev => prev + 1)
      toast.success('成功', '备忘录已归档')
    } catch (error) {
      console.error('Archive memo error:', error)
      toast.error('错误', '归档失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await memosApi.delete(id)
      setRefreshTrigger(prev => prev + 1)
      toast.success('成功', '备忘录已删除')
    } catch (error) {
      console.error('Delete memo error:', error)
      toast.error('错误', '删除失败')
    }
  }

  const handleSubmit = async (content: string) => {
    if (!content || content.trim().length === 0) {
      return
    }

    try {
      await memosApi.create({
        content: content.trim(),
        tags: [],
      })
      setRefreshTrigger(prev => prev + 1)
      toast.success('成功', '备忘录已创建')
    } catch (error) {
      console.error('Create memo error:', error)
      toast.error('错误', '创建备忘录失败')
    }
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
          refreshTrigger={refreshTrigger}
        />
      </View>

      <View style={[styles.inputContainer, { backgroundColor: theme.background }]}>
        <MemoInput onSubmit={handleSubmit} />
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
  inputContainer: {
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
})
