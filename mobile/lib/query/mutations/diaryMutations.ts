import type {
  CreateDiaryRequest,
  UpdateDiaryMoodRequest,
  UpdateDiaryRequest,
  UpdateDiarySummaryRequest,
} from '@mosaic/api'
import { diariesApi } from '@mosaic/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreateDiary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: Partial<CreateDiaryRequest> }) =>
      diariesApi.createOrUpdate(date, data as any),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['diary', date] })
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useUpdateDiary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: UpdateDiaryRequest }) =>
      diariesApi.update(date, data as any),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['diary', date] })
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
    },
  })
}

export function useUpdateDiarySummary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: UpdateDiarySummaryRequest }) =>
      diariesApi.updateSummary(date, data),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['diary', date] })
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
    },
  })
}

export function useUpdateDiaryMood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: UpdateDiaryMoodRequest }) =>
      diariesApi.updateMood(date, data as any),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['diary', date] })
      queryClient.invalidateQueries({ queryKey: ['diaries'] })
    },
  })
}
