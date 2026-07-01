import { LocalPushService } from '@/lib/services/local-push'
import { customPushStorage, type CustomPushData } from '@/lib/services/local-push/custom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const CUSTOM_PUSH_KEY = ['customPush']
export const CUSTOM_PUSH_COUNT_KEY = ['customPush', 'count']

export function useCustomPushCount() {
  return useQuery({
    queryKey: CUSTOM_PUSH_COUNT_KEY,
    queryFn: async () => {
      const pushes = await customPushStorage.getAllPushes()
      return pushes.length
    },
    staleTime: Infinity,
  })
}

export function useCustomPushList() {
  return useQuery({
    queryKey: CUSTOM_PUSH_KEY,
    queryFn: () => customPushStorage.getAllPushes(),
    staleTime: Infinity,
  })
}

export function useSaveCustomPush() {
  const queryClient = useQueryClient()
  const localPush = LocalPushService.getInstance()

  return useMutation({
    mutationFn: async (data: CustomPushData) => {
      await customPushStorage.saveCustomPush(data)

      // Lazy-load SchedulableTriggerInputTypes (not available in Expo Go)
      let calendarType: string
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const notifications = require('expo-notifications') as typeof import('expo-notifications')
        calendarType = notifications.SchedulableTriggerInputTypes.CALENDAR
      } catch {
        calendarType = 'calendar'
      }

      const triggerDateObj = new Date(data.trigger)
      await localPush.registerNotification(
        { title: data.title, body: data.body },
        {
          type: calendarType as any,
          year: triggerDateObj.getFullYear(),
          month: triggerDateObj.getMonth() + 1,
          day: triggerDateObj.getDate(),
          hour: triggerDateObj.getHours(),
          minute: triggerDateObj.getMinutes(),
        },
        data.name
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_PUSH_KEY })
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
    },
  })
}
