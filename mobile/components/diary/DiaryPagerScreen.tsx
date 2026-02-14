import { useDiaryPager } from '@/hooks/use-diary-pager'
import { useThemeStore } from '@/stores/theme-store'
import dayjs from 'dayjs'
import { router } from 'expo-router'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native'
import { useCallback, useMemo, useRef } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import PagerView from 'react-native-pager-view'
import { DayPageView } from './DayPageView'

const PREFETCH_DAYS = 2
const TOTAL_PAGES = PREFETCH_DAYS * 2 + 1

export function DiaryPagerScreen() {
  const { theme } = useThemeStore()
  const pagerRef = useRef<PagerView>(null)
  const currentPageRef = useRef(PREFETCH_DAYS)
  const skipNextPageSelectedRef = useRef(false)
  
  const {
    currentDate,
    setCurrentDate,
  } = useDiaryPager({
    prefetchDays: PREFETCH_DAYS,
  })

  const todayIndex = PREFETCH_DAYS
  const today = useMemo(() => dayjs().startOf('day'), [])
  const isToday = useMemo(
    () => dayjs(currentDate).isSame(today, 'day'),
    [currentDate, today]
  )

  const displayDates = useMemo(() => {
    return Array.from({ length: TOTAL_PAGES }, (_, index) =>
      dayjs(currentDate).add(index - todayIndex, 'day').format('YYYY-MM-DD')
    )
  }, [currentDate, todayIndex])

  const handleMemoPress = useCallback((memoId: string) => {
    router.push({ pathname: '/memo/[id]', params: { id: memoId } })
  }, [])

  const normalizeAndClampDate = useCallback((date: string) => {
    const nextDate = dayjs(date)
    if (nextDate.isAfter(today, 'day')) {
      return today.format('YYYY-MM-DD')
    }
    return nextDate.format('YYYY-MM-DD')
  }, [today])

  const navigateToDate = useCallback((date: string) => {
    const safeDate = normalizeAndClampDate(date)
    if (safeDate === currentDate) return
    setCurrentDate(safeDate)

    if (currentPageRef.current !== todayIndex) {
      skipNextPageSelectedRef.current = true
      pagerRef.current?.setPageWithoutAnimation(todayIndex)
      currentPageRef.current = todayIndex
    }
  }, [currentDate, normalizeAndClampDate, setCurrentDate, todayIndex])

  const handlePageSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    const newIndex = e.nativeEvent.position
    currentPageRef.current = newIndex

    if (skipNextPageSelectedRef.current) {
      skipNextPageSelectedRef.current = false
      return
    }

    const targetDate = displayDates[newIndex]
    if (!targetDate) return
    navigateToDate(targetDate)
  }, [displayDates, navigateToDate])

  const handlePreviousMonth = useCallback(() => {
    navigateToDate(dayjs(currentDate).subtract(1, 'month').format('YYYY-MM-DD'))
  }, [currentDate, navigateToDate])

  const handlePreviousYear = useCallback(() => {
    navigateToDate(dayjs(currentDate).subtract(1, 'year').format('YYYY-MM-DD'))
  }, [currentDate, navigateToDate])

  const handleNextMonth = useCallback(() => {
    navigateToDate(dayjs(currentDate).add(1, 'month').format('YYYY-MM-DD'))
  }, [currentDate, navigateToDate])

  const handleNextYear = useCallback(() => {
    navigateToDate(dayjs(currentDate).add(1, 'year').format('YYYY-MM-DD'))
  }, [currentDate, navigateToDate])

  const renderPage = useCallback((date: string) => {
    return (
      <View key={date} style={styles.pageContainer}>
        <DayPageView
          date={date}
          onMemoPress={handleMemoPress}
        />
      </View>
    )
  }, [handleMemoPress])

  const pages = displayDates.map(renderPage)

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={handlePreviousYear}
          hitSlop={8}
        >
          <ChevronsLeft size={22} color={theme.text} strokeWidth={2.2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handlePreviousMonth}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={theme.text} strokeWidth={2.2} />
        </TouchableOpacity>

        <Text style={[styles.currentDate, { color: theme.text }]}>
          {dayjs(currentDate).format('YYYY-MM-DD')}
        </Text>

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

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={todayIndex}
        onPageSelected={handlePageSelected}
        overdrag={true}
      >
        {pages}
      </PagerView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  navButton: {
    padding: 8,
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  pager: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
})
