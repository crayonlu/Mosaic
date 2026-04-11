import { useDiaryPager } from '@/hooks/useDiaryPager'
import { useMoodStore } from '@/stores/moodStore'
import { useThemeStore } from '@/stores/themeStore'
import dayjs from 'dayjs'
import { router } from 'expo-router'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import PagerView from 'react-native-pager-view'
import { DayPageView } from './DayPageView'

const PREFETCH_DAYS = 2

interface DiaryPagerScreenProps {
  initialDate?: string
}

export function DiaryPagerScreen({ initialDate }: DiaryPagerScreenProps) {
  const { theme } = useThemeStore()
  const { setCurrentMood } = useMoodStore()
  const pagerRef = useRef<PagerView>(null)
  const currentPageRef = useRef(PREFETCH_DAYS)
  const skipNextPageSelectedRef = useRef(false)
  const handledRouteDateRef = useRef<string | null>(null)
  const pendingRouteDateRef = useRef<string | null>(null)

  const { currentDate, setCurrentDate, diaryQuery } = useDiaryPager({
    prefetchDays: PREFETCH_DAYS,
    initialDate,
  })

  useEffect(() => {
    if (diaryQuery.status === 'success') {
      if (diaryQuery.data?.date === currentDate) {
        setCurrentMood(diaryQuery.data.moodKey, diaryQuery.data.moodScore ?? 5)
      } else {
        setCurrentMood(undefined, 5)
      }
      return
    }

    if (diaryQuery.status === 'error') {
      setCurrentMood(undefined, 5)
    }
  }, [
    currentDate,
    diaryQuery.status,
    diaryQuery.data?.date,
    diaryQuery.data?.moodKey,
    diaryQuery.data?.moodScore,
    setCurrentMood,
  ])

  const today = useMemo(() => dayjs().startOf('day'), [])
  const isToday = useMemo(() => dayjs(currentDate).isSame(today, 'day'), [currentDate, today])

  useEffect(() => {
    if (dayjs(currentDate).isAfter(today, 'day')) {
      setCurrentDate(today.format('YYYY-MM-DD'))
    }
  }, [currentDate, setCurrentDate, today])

  const currentPageIndex = PREFETCH_DAYS

  const displayDates = useMemo(() => {
    const safeCurrent = dayjs(currentDate).isAfter(today, 'day') ? today : dayjs(currentDate)
    const availableFutureDays = Math.max(0, dayjs(today).diff(safeCurrent, 'day'))
    const futureDays = Math.min(PREFETCH_DAYS, availableFutureDays)
    const totalPages = PREFETCH_DAYS + futureDays + 1

    return Array.from({ length: totalPages }, (_, index) =>
      safeCurrent
        .add(index - currentPageIndex, 'day')
        .format('YYYY-MM-DD')
    )
  }, [currentDate, currentPageIndex, today])

  useEffect(() => {
    if (currentPageRef.current !== currentPageIndex) {
      skipNextPageSelectedRef.current = true
      pagerRef.current?.setPageWithoutAnimation(currentPageIndex)
      currentPageRef.current = currentPageIndex
      return
    }

    skipNextPageSelectedRef.current = false
  }, [currentDate, currentPageIndex])

  const handleMemoPress = useCallback((memoId: string) => {
    router.push({ pathname: '/memo/[id]', params: { id: memoId } })
  }, [])

  const normalizeAndClampDate = useCallback(
    (date: string) => {
      const nextDate = dayjs(date)
      if (nextDate.isAfter(today, 'day')) {
        return today.format('YYYY-MM-DD')
      }
      return nextDate.format('YYYY-MM-DD')
    },
    [today]
  )

  const navigateToDate = useCallback(
    (date: string) => {
      const safeDate = normalizeAndClampDate(date)
      if (safeDate === currentDate) return
      setCurrentDate(safeDate)

      if (currentPageRef.current !== currentPageIndex) {
        skipNextPageSelectedRef.current = true
        pagerRef.current?.setPageWithoutAnimation(currentPageIndex)
        currentPageRef.current = currentPageIndex
      }
    },
    [currentDate, currentPageIndex, normalizeAndClampDate, setCurrentDate]
  )

  useEffect(() => {
    if (!initialDate) return

    const safeDate = normalizeAndClampDate(initialDate)
    if (handledRouteDateRef.current === safeDate) {
      return
    }

    handledRouteDateRef.current = safeDate
    pendingRouteDateRef.current = safeDate

    if (currentDate !== safeDate) {
      setCurrentDate(safeDate)
    }

    skipNextPageSelectedRef.current = true
    pagerRef.current?.setPageWithoutAnimation(currentPageIndex)
    currentPageRef.current = currentPageIndex
  }, [currentDate, currentPageIndex, initialDate, normalizeAndClampDate, setCurrentDate])

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const newIndex = e.nativeEvent.position

      if (pendingRouteDateRef.current && newIndex !== currentPageIndex) {
        skipNextPageSelectedRef.current = true
        pagerRef.current?.setPageWithoutAnimation(currentPageIndex)
        currentPageRef.current = currentPageIndex
        return
      }

      currentPageRef.current = newIndex

      if (skipNextPageSelectedRef.current) {
        skipNextPageSelectedRef.current = false
        if (pendingRouteDateRef.current && newIndex === currentPageIndex) {
          pendingRouteDateRef.current = null
        }
        return
      }

      const targetDate = displayDates[newIndex]
      if (!targetDate) return

      if (pendingRouteDateRef.current && targetDate !== pendingRouteDateRef.current) {
        return
      }

      if (pendingRouteDateRef.current && targetDate === pendingRouteDateRef.current) {
        pendingRouteDateRef.current = null
      }

      navigateToDate(targetDate)
    },
    [currentPageIndex, displayDates, navigateToDate]
  )

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

  const renderPage = useCallback(
    (date: string) => {
      return (
        <View key={date} style={styles.pageContainer}>
          <DayPageView date={date} onMemoPress={handleMemoPress} />
        </View>
      )
    },
    [handleMemoPress]
  )

  const pages = displayDates.map(renderPage)

  return (
    <View style={[styles.container]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.navButton} onPress={handlePreviousYear} hitSlop={8}>
          <ChevronsLeft size={22} color={theme.text} strokeWidth={2.2} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={handlePreviousMonth} hitSlop={8}>
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
        initialPage={currentPageIndex}
        onPageSelected={handlePageSelected}
        overdrag={!isToday}
      >
        {pages}
      </PagerView>
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
    fontWeight: '500',
  },
  pager: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pageContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
})
