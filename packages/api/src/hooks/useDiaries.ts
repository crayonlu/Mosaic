import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { diariesApi } from '../diaries'
import type {
  CreateDiaryRequest,
  ListDiariesQuery,
  UpdateDiaryMoodRequest,
  UpdateDiaryRequest,
  UpdateDiarySummaryRequest,
} from '../types'

const DEFAULT_STALE_TIME = 5 * 60 * 1000

export function useDiaries(query?: ListDiariesQuery) {
  return useQuery({
    queryKey: ['diaries', 'list', query],
    queryFn: () => diariesApi.list(query),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useDiary(date: string) {
  return useQuery({
    queryKey: ['diaries', date],
    queryFn: () => diariesApi.get(date),
    staleTime: DEFAULT_STALE_TIME,
    enabled: !!date,
  })
}

export function useCreateDiary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: Omit<CreateDiaryRequest, 'date'> }) =>
      diariesApi.create(date, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
    },
  })
}

export function useCreateOrUpdateDiary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: Partial<CreateDiaryRequest> }) =>
      diariesApi.createOrUpdate(date, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
      queryClient.invalidateQueries({ queryKey: ['diaries', date] })
    },
  })
}

export function useUpdateDiary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: UpdateDiaryRequest }) =>
      diariesApi.update(date, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
      queryClient.invalidateQueries({ queryKey: ['diaries', date] })
    },
  })
}

export function useUpdateDiarySummary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: UpdateDiarySummaryRequest }) =>
      diariesApi.updateSummary(date, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
      queryClient.invalidateQueries({ queryKey: ['diaries', date] })
    },
  })
}

export function useUpdateDiaryMood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: UpdateDiaryMoodRequest }) =>
      diariesApi.updateMood(date, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
      queryClient.invalidateQueries({ queryKey: ['diaries', date] })
    },
  })
}
