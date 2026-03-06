import { LocalPushService } from '@/lib/services/local-push'
import { customPushStorage, type CustomPushData } from '@/lib/services/local-push/custom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SchedulableTriggerInputTypes } from 'expo-notifications'

export const CUSTOM_PUSH_KEY = ['customPush']
export const CUSTOM_PUSH_COUNT_KEY = ['customPush', 'count']

export function useCustomPushCount() {
  return useQuery({
    queryKey: CUSTOM_PUSH_COUNT_KEY,
    queryFn: async () => {
      const pushes = await customPushStorage.getAllPushes()
      return pushes.length
    },
  })
}

export function useCustomPushList() {
  return useQuery({
    queryKey: CUSTOM_PUSH_KEY,
    queryFn: () => customPushStorage.getAllPushes(),
  })
}

export function useSaveCustomPush() {
  const queryClient = useQueryClient()
  const localPush = LocalPushService.getInstance()

  return useMutation({
    mutationFn: async (data: CustomPushData) => {
      await customPushStorage.saveCustomPush(data)

      const triggerDateObj = new Date(data.trigger)
      await localPush.registerNotification(
        { title: data.title, body: data.body },
        {
          type: SchedulableTriggerInputTypes.CALENDAR,
          year: triggerDateObj.getFullYear(),
          month: triggerDateObj.getMonth() + 1,
          day: triggerDateObj.getDate(),
          hour: triggerDateObj.getHours(),
          minute: triggerDateObj.getMinutes(),
        }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_PUSH_KEY })
      queryClient.invalidateQueries({ queryKey: CUSTOM_PUSH_COUNT_KEY })
    },
  })
}

export function useDeleteCustomPush() {
  const queryClient = useQueryClient()
  const localPush = LocalPushService.getInstance()

  return useMutation({
    mutationFn: async (name: string) => {
      await customPushStorage.deleteOneCustomPush(name)
      await localPush.cancelNotification(name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_PUSH_KEY })
      queryClient.invalidateQueries({ queryKey: CUSTOM_PUSH_COUNT_KEY })
    },
  })
}
