import { diariesApi } from '@/lib/api/diaries'
import { MoodKey } from '@/types'
import type { DiaryWithMemosResponse } from '@/types/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
interface UseDiaryPagerOptions {
  initialDate?: string
  prefetchDays?: number
}

interface UseDiaryPagerReturn {
  currentDate: string
  currentMood: MoodKey | undefined
  currentMoodIntensity: number
  setCurrentDate: (date: string) => void
  goToPreviousDay: () => void
  goToNextDay: () => void
  goToPreviousMonth: () => void
  goToNextMonth: () => void
  goToPreviousYear: () => void
  goToNextYear: () => void
  goToToday: () => void
  diaryQuery: ReturnType<typeof useQuery<DiaryWithMemosResponse>>
  prefetchDates: string[]
}

export function useDiaryPager(options: UseDiaryPagerOptions = {}): UseDiaryPagerReturn {
  const { initialDate, prefetchDays = 2 } = options
  const queryClient = useQueryClient()

  const [currentDate, setCurrentDate] = useState(() => {
    if (initialDate) return initialDate
    return dayjs().format('YYYY-MM-DD')
  })

  useEffect(() => {
    if (initialDate) setCurrentDate(initialDate)
  }, [initialDate])

  const diaryQuery = useQuery({
    queryKey: ['diary', currentDate],
    queryFn: () => diariesApi.get(currentDate),
    staleTime: 5 * 60 * 1000,
  })

  const prefetchDates = useMemo(() => {
    const dates: string[] = []
    for (let i = 1; i <= prefetchDays; i++) {
      dates.push(dayjs(currentDate).subtract(i, 'day').format('YYYY-MM-DD'))
      dates.push(dayjs(currentDate).add(i, 'day').format('YYYY-MM-DD'))
    }
    return dates
  }, [currentDate, prefetchDays])

  useEffect(() => {
    prefetchDates.forEach(date => {
      queryClient.prefetchQuery({
        queryKey: ['diary', date],
        queryFn: () => diariesApi.get(date),
        staleTime: 10 * 60 * 1000,
      })
    })
  }, [prefetchDates, queryClient])

  const shiftCurrentDate = useCallback((value: number, unit: dayjs.ManipulateType) => {
    setCurrentDate(prevDate => dayjs(prevDate).add(value, unit).format('YYYY-MM-DD'))
  }, [])

  const goToPreviousDay = useCallback(() => {
    shiftCurrentDate(-1, 'day')
  }, [shiftCurrentDate])

  const goToNextDay = useCallback(() => {
    shiftCurrentDate(1, 'day')
  }, [shiftCurrentDate])

  const goToPreviousMonth = useCallback(() => {
    shiftCurrentDate(-1, 'month')
  }, [shiftCurrentDate])

  const goToNextMonth = useCallback(() => {
    shiftCurrentDate(1, 'month')
  }, [shiftCurrentDate])

  const goToPreviousYear = useCallback(() => {
    shiftCurrentDate(-1, 'year')
  }, [shiftCurrentDate])

  const goToNextYear = useCallback(() => {
    shiftCurrentDate(1, 'year')
  }, [shiftCurrentDate])

  const goToToday = useCallback(() => {
    setCurrentDate(dayjs().format('YYYY-MM-DD'))
  }, [])

  const handleSetCurrentDate = useCallback((date: string) => {
    setCurrentDate(dayjs(date).format('YYYY-MM-DD'))
  }, [])

  return {
    currentDate,
    currentMood: diaryQuery.data?.moodKey ?? undefined,
    currentMoodIntensity: diaryQuery.data?.moodScore ?? 5,
    setCurrentDate: handleSetCurrentDate,
    goToPreviousDay,
    goToNextDay,
    goToPreviousMonth,
    goToNextMonth,
    goToPreviousYear,
    goToNextYear,
    goToToday,
    diaryQuery,
    prefetchDates,
  }
}
