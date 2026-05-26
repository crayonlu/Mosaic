import InfinitePager, {
  type InfinitePagerImperativeApi,
  type InfinitePagerPageProps,
} from 'react-native-infinite-pager'
import { useDiaryPager } from '@/hooks/useDiaryPager'
import { useMoodStore } from '@/stores/moodStore'
import { useThemeStore } from '@/stores/themeStore'
import type { DiaryWithMemosResponse } from '@mosaic/api'
import dayjs from 'dayjs'
import { router } from 'expo-router'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated'
import { useQueryClient } from '@tanstack/react-query'
import { type DayPageViewRef, DayPageView } from './DayPageView'

// Fixed epoch: today - PAST_DAYS. index 0 = epoch, index PAST_DAYS = today.
const PAST_DAYS = 365
const EPOCH = dayjs().startOf('day').subtract(PAST_DAYS, 'day')
const TODAY_INDEX = PAST_DAYS

function indexToDate(index: number): string {
  return EPOCH.add(index, 'day').format('YYYY-MM-DD')
}

function dateToIndex(date: string): number {
  return dayjs(date).diff(EPOCH, 'day')
}

interface DiaryPagerScreenProps {
  initialDate?: string
}

interface DiaryPageProps extends InfinitePagerPageProps {
  currentDate: string
  isEditing: boolean
  onMemoPress: (id: string) => void
  onEditStateChange: () => void
  dayPageRefs: React.MutableRefObject<Map<string, DayPageViewRef>>
}

function DateCardView({ date }: { date: string }) {
  const theme = useThemeStore(s => s.theme)
  const d = dayjs(date)
  return (
    <View style={styles.dateCardContainer}>
      <Text style={[styles.dateCardDay, { color: theme.text }]}>{d.format('D')}</Text>
      <Text style={[styles.dateCardWeekday, { color: theme.textSecondary }]}>
        {d.format('ddd').toUpperCase()}
      </Text>
    </View>
  )
}

function DiaryPage({
  index,
  isActive,
  currentDate,
  isEditing,
  onMemoPress,
  onEditStateChange,
  dayPageRefs,
}: DiaryPageProps) {
  const date = indexToDate(index)

  return (
    <View style={styles.pageContainer}>
      {isActive ? (
        <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(180)}>
          <DayPageView
            date={date}
            onMemoPress={onMemoPress}
            isEditing={isEditing}
            isCurrent
            onEditStateChange={onEditStateChange}
            onRegisterRef={ref => {
              if (ref) dayPageRefs.current.set(date, ref)
              else dayPageRefs.current.delete(date)
            }}
          />
        </Animated.View>
      ) : (
        <DateCardView date={date} />
      )}
    </View>
  )
}

export function DiaryPagerScreen({ initialDate }: DiaryPagerScreenProps) {
  const theme = useThemeStore(s => s.theme)
  const setCurrentMood = useMoodStore(s => s.setCurrentMood)
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const pagerRef = useRef<InfinitePagerImperativeApi>(null)
  const dayPageRefs = useRef<Map<string, DayPageViewRef>>(new Map())
  const handledRouteDateRef = useRef<string | null>(null)
  const isFirstLoadRef = useRef(true)

  const [isEditing, setIsEditing] = useState(false)
  const [, setEditTick] = useState(0)
  const [pendingDisplayDate, setPendingDisplayDate] = useState<string | null>(null)

  const today = useMemo(() => dayjs().startOf('day'), [])

  const { currentDate, setCurrentDate, diaryQuery } = useDiaryPager({
    prefetchDays: 2,
    initialDate,
  })

  const isToday = useMemo(() => dayjs(currentDate).isSame(today, 'day'), [currentDate, today])
  const displayedDate = pendingDisplayDate ?? currentDate
  const hasDiary = diaryQuery.status === 'success' && !!diaryQuery.data

  const normalizeDate = useCallback(
    (date: string) => {
      const d = dayjs(date)
      return d.isAfter(today, 'day') ? today.format('YYYY-MM-DD') : d.format('YYYY-MM-DD')
    },
    [today]
  )

  const navigateToDate = useCallback(
    (date: string, animated = true) => {
      const safeDate = normalizeDate(date)
      if (safeDate === currentDate) return
      setCurrentDate(safeDate)
      const index = dateToIndex(safeDate)
      const delta = Math.abs(dayjs(safeDate).diff(dayjs(currentDate), 'day'))
      // Large jumps (>7 days): instant teleport — spring animation across many pages
      // just flickers through cards too fast to be meaningful.
      // Small jumps (≤7 days): spring animation gives natural page-flip feel.
      pagerRef.current?.setPage(index, { animated: animated && delta <= 7 })
    },
    [currentDate, normalizeDate, setCurrentDate]
  )

  // On page change from user swipe: update currentDate + eagerly sync mood from cache
  const handlePageChange = useCallback(
    (index: number) => {
      const date = indexToDate(index)
      if (date > today.format('YYYY-MM-DD')) return
      setPendingDisplayDate(null)
      setCurrentDate(date)
      const cached = queryClient.getQueryData<DiaryWithMemosResponse>(['diary', date])
      if (cached) setCurrentMood(cached.moodKey, cached.moodScore ?? 5)
      else setCurrentMood(undefined, 5)
    },
    [queryClient, setCurrentDate, setCurrentMood, today]
  )

  useEffect(() => {
    if (!initialDate) return
    const safeDate = normalizeDate(initialDate)
    if (handledRouteDateRef.current === safeDate) return
    handledRouteDateRef.current = safeDate
    const animated = !isFirstLoadRef.current
    isFirstLoadRef.current = false
    navigateToDate(safeDate, animated)
  }, [initialDate, navigateToDate, normalizeDate])

  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false
      const index = dateToIndex(currentDate)
      pagerRef.current?.setPage(index, { animated: false })
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (dayjs(currentDate).isAfter(today, 'day')) setCurrentDate(today.format('YYYY-MM-DD'))
  }, [currentDate, setCurrentDate, today])

  useEffect(() => {
    setIsEditing(false)
  }, [currentDate])

  useEffect(() => {
    if (diaryQuery.status === 'success') {
      if (diaryQuery.data?.date === currentDate) {
        setCurrentMood(diaryQuery.data.moodKey, diaryQuery.data.moodScore ?? 5)
      } else {
        setCurrentMood(undefined, 5)
      }
      return
    }
    if (diaryQuery.status === 'error') setCurrentMood(undefined, 5)
  }, [
    currentDate,
    diaryQuery.status,
    diaryQuery.data?.date,
    diaryQuery.data?.moodKey,
    diaryQuery.data?.moodScore,
    setCurrentMood,
  ])

  const handleMemoPress = useCallback((memoId: string) => {
    router.push({ pathname: '/memo/[id]', params: { id: memoId } })
  }, [])

  const handleStartEdit = useCallback(() => setIsEditing(true), [])
  const handleCancelEdit = useCallback(() => {
    dayPageRefs.current.get(currentDate)?.cancel()
    setIsEditing(false)
  }, [currentDate])
  const handleSave = useCallback(async () => {
    await dayPageRefs.current.get(currentDate)?.save()
    setIsEditing(false)
  }, [currentDate])
  const refreshEditState = useCallback(() => setEditTick(n => n + 1), [])

  const handlePreviousMonth = useCallback(
    () => navigateToDate(dayjs(currentDate).subtract(1, 'month').format('YYYY-MM-DD')),
    [currentDate, navigateToDate]
  )
  const handlePreviousYear = useCallback(
    () => navigateToDate(dayjs(currentDate).subtract(1, 'year').format('YYYY-MM-DD')),
    [currentDate, navigateToDate]
  )
  const handleNextMonth = useCallback(
    () => navigateToDate(dayjs(currentDate).add(1, 'month').format('YYYY-MM-DD')),
    [currentDate, navigateToDate]
  )
  const handleNextYear = useCallback(
    () => navigateToDate(dayjs(currentDate).add(1, 'year').format('YYYY-MM-DD')),
    [currentDate, navigateToDate]
  )

  const hasChanges = dayPageRefs.current.get(currentDate)?.hasChanges ?? false
  const isSaving = dayPageRefs.current.get(currentDate)?.isPending ?? false

  const renderPage = useCallback(
    (props: InfinitePagerPageProps) => (
      <DiaryPage
        {...props}
        currentDate={currentDate}
        isEditing={isEditing}
        onMemoPress={handleMemoPress}
        onEditStateChange={refreshEditState}
        dayPageRefs={dayPageRefs}
      />
    ),
    [currentDate, handleMemoPress, isEditing, refreshEditState]
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {isEditing ? (
          <Animated.View
            key="header-left-cancel"
            entering={FadeIn.duration(150).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(100).easing(Easing.out(Easing.cubic))}
          >
            <TouchableOpacity style={styles.headerAction} onPress={handleCancelEdit}>
              <Text style={[styles.headerActionText, { color: theme.textSecondary }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View
            key="header-left-nav"
            entering={FadeIn.duration(150).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(100).easing(Easing.out(Easing.cubic))}
          >
            <View style={styles.headerNavGroup}>
              <TouchableOpacity style={styles.navButton} onPress={handlePreviousYear} hitSlop={8}>
                <ChevronsLeft size={22} color={theme.text} strokeWidth={2.2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.navButton} onPress={handlePreviousMonth} hitSlop={8}>
                <ChevronLeft size={22} color={theme.text} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        <View style={styles.headerCenter} pointerEvents="box-none">
          <Text style={[styles.currentDate, { color: theme.text }]}>
            {dayjs(displayedDate).format('YYYY-MM-DD')}
          </Text>
          {!isEditing && hasDiary && (
            <TouchableOpacity style={styles.editButton} onPress={handleStartEdit} hitSlop={8}>
              <Pencil size={18} color={theme.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <Animated.View
            key="header-right-save"
            entering={FadeIn.duration(150).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(100).easing(Easing.out(Easing.cubic))}
          >
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => {
                refreshEditState()
                void handleSave()
              }}
              disabled={!hasChanges || isSaving}
            >
              <Text
                style={[
                  styles.headerActionText,
                  { color: hasChanges && !isSaving ? theme.primary : theme.textSecondary },
                ]}
              >
                {isSaving ? t('common.saving') : t('common.save')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View
            key="header-right-nav"
            entering={FadeIn.duration(150).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(100).easing(Easing.out(Easing.cubic))}
          >
            <View style={styles.headerNavGroup}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={handleNextMonth}
                disabled={isToday}
                hitSlop={8}
              >
                <ChevronRight
                  size={22}
                  color={isToday ? theme.textSecondary : theme.text}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navButton}
                onPress={handleNextYear}
                disabled={isToday}
                hitSlop={8}
              >
                <ChevronsRight
                  size={22}
                  color={isToday ? theme.textSecondary : theme.text}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>

      <InfinitePager
        ref={pagerRef}
        renderPage={renderPage}
        initialIndex={TODAY_INDEX}
        maxIndex={TODAY_INDEX}
        onPageChange={handlePageChange}
        pageBuffer={2}
        style={styles.pager}
        pageWrapperStyle={styles.pageContainer}
        animationConfig={{
          damping: 20,
          mass: 0.2,
          stiffness: 100,
          overshootClamping: true,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  headerNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: 50,
    padding: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAction: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 72,
  },
  headerActionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  currentDate: {
    fontSize: 16,
    fontWeight: '500',
  },
  pager: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dateCardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardDay: {
    fontSize: 56,
    fontWeight: '200',
    lineHeight: 60,
  },
  dateCardWeekday: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
})
