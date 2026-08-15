import { MoodHeatMap } from '@/components/archive/MoodHeatMap'
import { MemoInput } from '@/components/editor/MemoInput'
import { MemoList } from '@/components/memo/MemoList'
import { toast } from '@/components/ui'
import { useConnection } from '@/hooks/useConnection'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useToastConfirm } from '@/hooks/useToastConfirm'
import { SafeKeyboardStickyView, useSafeKeyboardAnimation } from '@/lib/native/safeProviders'
import { useCreateMemo, useDeleteMemo } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import { type MemoWithResources } from '@mosaic/api'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Animated, StyleSheet, View } from 'react-native'
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
  const insets = useSafeAreaInsets()
  const { progress } = useSafeKeyboardAnimation()

  const isPending = isCreating || isDeleting

  // Fade the input frame border in/out in sync with the keyboard animation via the
  // RN Animated native driver (an overlay whose opacity follows keyboard progress).
  // Flipping the border on focus/blur is wrong (blur fires only after the keyboard
  // fully collapses), and per-frame Reanimated prop updates cause frame drops here.
  const borderFadeOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

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
            },
          ]}
        >
          <MemoInput onSubmit={handleSubmit} disabled={!canUseNetwork || isPending} />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.inputBorder,
              {
                borderColor: theme.border,
                opacity: borderFadeOpacity,
              },
            ]}
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
    padding: 12,
  },
  inputBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
})
