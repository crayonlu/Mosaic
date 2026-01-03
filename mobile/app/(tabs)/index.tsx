import { MemoInput } from '@/components/MemoInput'
import { useThemeStore } from '@/stores/theme-store'
import { StyleSheet, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

export default function HomeScreen() {
  const { theme } = useThemeStore()

  const handleSubmit = (content: string) => {
    // TODO: Implement memo creation
    console.log('Creating memo:', content)
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
      >
        {/* Memo List */}
        <View style={styles.listContainer}>
          {/* TODO: Add MemoList component */}
        </View>
      </KeyboardAwareScrollView>

      {/* Input at bottom */}
      <View style={[styles.inputContainer, { backgroundColor: theme.background }]}>
        <MemoInput onSubmit={handleSubmit} />
      </View>
    </View>
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
})
