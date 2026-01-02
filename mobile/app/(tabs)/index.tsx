import { MemoInput } from '@/components/MemoInput'
import { useThemeStore } from '@/stores/theme-store'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'

export default function HomeScreen() {
  const { theme } = useThemeStore()

  const handleSubmit = (content: string) => {
    // TODO: Implement memo creation
    console.log('Creating memo:', content)
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Memo List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* TODO: Add MemoList component */}
      </ScrollView>

      {/* Input at bottom */}
      <MemoInput onSubmit={handleSubmit} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
})
