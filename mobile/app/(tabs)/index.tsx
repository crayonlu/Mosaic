import { MemoInput } from '@/components/editor/MemoInput'
import { MemoList } from '@/components/memo/MemoList'
import { toast } from '@/components/ui/Toast'
import { memoService } from '@/lib/services/memo-service'
import { useThemeStore } from '@/stores/theme-store'
import { type MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

export default function HomeScreen() {
  const { theme } = useThemeStore()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const handleMemoPress = (memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleArchive = async (id: string) => {
    try {
      await memoService.archiveMemo(id)
      setRefreshTrigger(prev => prev + 1)
      toast.success('成功', '备忘录已归档')
    } catch (error) {
      toast.error('错误', '归档失败')
      console.error('Archive error:', error)
    }
  }

  const handleDelete = async (id: string) => {
    // Direct deletion without confirmation for now
    try {
      await memoService.deleteMemo(id)
      setRefreshTrigger(prev => prev + 1)
      toast.success('成功', '备忘录已删除')
    } catch (error) {
      toast.error('错误', '删除失败')
      console.error('Delete error:', error)
    }
  }

  const handleSubmit = async (content: string) => {
    if (!content || content.trim().length === 0) {
      return
    }

    try {
      await memoService.createMemo({
        content: content.trim(),
        tags: [],
      })
      setRefreshTrigger(prev => prev + 1)
      toast.success('成功', '备忘录已创建')
    } catch (error) {
      toast.error('错误', '创建备忘录失败')
      console.error('Create memo error:', error)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      // android keyboard offset is 44px, but why???
      // it works in my xiaomi 14
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 44}
    >
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
      >
        {/* Memo List */}
        <View style={styles.listContainer}>
          <MemoList
            onMemoPress={handleMemoPress}
            onMemoArchive={handleArchive}
            onMemoDelete={handleDelete}
            refreshTrigger={refreshTrigger}
          />
        </View>
      </KeyboardAwareScrollView>

      {/* Input at bottom */}
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    padding: 16,
  },
  listContainer: {
    flex: 1,
  },
  inputContainer: {
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
})
