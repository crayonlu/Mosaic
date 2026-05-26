import type { FlatList } from 'react-native'
import type { DiaryWithMemosResponse } from '@mosaic/api'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useCallback, useRef } from 'react'
import { Dimensions } from 'react-native'
import { useMoodStore } from '@/stores/moodStore'

export const ITEM_WIDTH = Dimensions.get('window').width
export const WINDOW_RADIUS = 365
export const TOTAL_ITEMS = WINDOW_RADIUS * 2 + 1
export const TODAY_INDEX = WINDOW_RADIUS

export function dateToIndex(date: string, anchorDate: dayjs.Dayjs): number {
  return dayjs(date).diff(anchorDate, 'day')
}

export function indexToDate(index: number, anchorDate: dayjs.Dayjs): string {
  return anchorDate.add(index, 'day').format('YYYY-MM-DD')
}

interface UseDiaryFlashListOptions {
  anchorDate: dayjs.Dayjs
  today: dayjs.Dayjs
  currentDate: string
  onCommitDate: (date: string) => void
  onPreviewDate: (date: string) => void
  onScrollEnd?: () => void
}

interface UseDiaryFlashListReturn {
  listRef: React.RefObject<FlatList<number> | null>
  isProgrammaticScrollRef: React.RefObject<boolean>
  isScrollingRef: React.RefObject<boolean>
  /** Register a one-shot callback that fires on the next momentum scroll end
   *  instead of the normal onCommitDate path. Used by step-jump to advance one
   *  day at a time while the pager is under programmatic control. */
  onNextMomentumRef: React.RefObject<(() => void) | null>
  handleMomentumScrollEnd: (e: { nativeEvent: { contentOffset: { x: number } } }) => void
  handleScrollBeginDrag: () => void
  handleScroll: (e: { nativeEvent: { contentOffset: { x: number } } }) => void
  scrollToIndex: (index: number, animated: boolean) => void
  scrollToDate: (date: string, animated?: boolean) => void
}

export function useDiaryFlashList({
  anchorDate,
  today,
  currentDate,
  onCommitDate,
  onPreviewDate,
  onScrollEnd,
}: UseDiaryFlashListOptions): UseDiaryFlashListReturn {
  const listRef = useRef<FlatList<number> | null>(null)
  const isProgrammaticScrollRef = useRef(false)
  const isScrollingRef = useRef(false)
  const onNextMomentumRef = useRef<(() => void) | null>(null)
  const queryClient = useQueryClient()
  const setCurrentMood = useMoodStore(s => s.setCurrentMood)
  const lastPreviewIndexRef = useRef(-1)

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    isProgrammaticScrollRef.current = true
    listRef.current?.scrollToIndex({ index, animated, viewOffset: 0, viewPosition: 0 })
  }, [])

  const scrollToDate = useCallback(
    (date: string, animated = false) => {
      const safeDate = dayjs(date).isAfter(today, 'day') ? today.format('YYYY-MM-DD') : date
      scrollToIndex(dateToIndex(safeDate, anchorDate), animated)
    },
    [anchorDate, scrollToIndex, today]
  )

  const handleScrollBeginDrag = useCallback(() => {
    isProgrammaticScrollRef.current = false
    isScrollingRef.current = true
  }, [])

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (isProgrammaticScrollRef.current) return
      const index = Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH)
      if (index === lastPreviewIndexRef.current) return
      lastPreviewIndexRef.current = index
      const date = indexToDate(index, anchorDate)
      if (date > today.format('YYYY-MM-DD')) return
      onPreviewDate(date)
      const cached = queryClient.getQueryData<DiaryWithMemosResponse>(['diary', date])
      if (cached) {
        setCurrentMood(cached.moodKey, cached.moodScore ?? 5)
      } else {
        setCurrentMood(undefined, 5)
      }
    },
    [anchorDate, onPreviewDate, queryClient, setCurrentMood, today]
  )

  const handleMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      isScrollingRef.current = false

      // Step-jump mode: hand control back to the jump animation hook.
      if (onNextMomentumRef.current) {
        const cb = onNextMomentumRef.current
        onNextMomentumRef.current = null
        cb()
        onScrollEnd?.()
        return
      }

      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false
        onScrollEnd?.()
        return
      }

      const index = Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH)
      const date = indexToDate(index, anchorDate)
      const safeDate = dayjs(date).isAfter(today, 'day') ? today.format('YYYY-MM-DD') : date
      if (safeDate !== currentDate) {
        onCommitDate(safeDate)
      } else {
        onScrollEnd?.()
      }
    },
    [anchorDate, currentDate, onCommitDate, onScrollEnd, today]
  )

  return {
    listRef,
    isProgrammaticScrollRef,
    isScrollingRef,
    onNextMomentumRef,
    handleMomentumScrollEnd,
    handleScrollBeginDrag,
    handleScroll,
    scrollToIndex,
    scrollToDate,
  }
}
