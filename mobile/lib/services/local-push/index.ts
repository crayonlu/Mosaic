import { mmkv } from '@/lib/storage/mmkv'
import type {
  NotificationContentInput,
  SchedulableNotificationTriggerInput,
} from 'expo-notifications'
import * as Notifications from 'expo-notifications'

export type RigsterSchedule = {
  content: NotificationContentInput
  trigger: SchedulableNotificationTriggerInput
}

const STORAGE_KEY = 'mosaic_disabled_push_notifications'
const DISABLED_VALUE = '1'

export class LocalPushService {
  private static instance: LocalPushService

  private constructor() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
  }

  /**
   * Singleton pattern
   */
  static getInstance(): LocalPushService {
    if (!LocalPushService.instance) LocalPushService.instance = new LocalPushService()
    return LocalPushService.instance
  }

  /**
   * @brief Get the current notification permissions status.
   * @returns Boolean
   */
  getNotificationPermissionStatus = async () => {
    const { status } = await Notifications.getPermissionsAsync()
    return status === 'granted'
  }

  /**
   * @brief Requests permission to show notifications to the user.
   * @returns Boolean
   */
  requestNotificationPermission = async () => {
    const isGranted = await this.getNotificationPermissionStatus()
    if (isGranted) return true
    const { status: newStatus } = await Notifications.requestPermissionsAsync()
    return newStatus === 'granted'
  }

  isPushDisabledByUser = () => {
    return mmkv.getString(STORAGE_KEY) === DISABLED_VALUE
  }

  /**
   * @brief Enable or disable app-level push switch stored locally.
   */
  setPushEnabled = async (enabled: boolean) => {
    if (enabled) {
      mmkv.remove(STORAGE_KEY)
      return
    }

    mmkv.set(STORAGE_KEY, DISABLED_VALUE)
    await Notifications.cancelAllScheduledNotificationsAsync()
  }

  /**
   * @brief Returns effective push status (system permission + app-level switch).
   */
  isPushEnabled = async () => {
    const granted = await this.getNotificationPermissionStatus()
    return granted && !this.isPushDisabledByUser()
  }

  registerNotification = async (
    content: NotificationContentInput,
    trigger: SchedulableNotificationTriggerInput
  ) => {
    if (this.isPushDisabledByUser()) return

    if (!(await this.getNotificationPermissionStatus())) {
      const isGranted = await this.requestNotificationPermission()
      if (!isGranted) throw new Error('Notification permission not granted')
    }

    await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    })
  }

  /**
   * @brief Cancels a scheduled notification by its identifier.
   * @param identifier The notification identifier to cancel.
   */
  cancelNotification = async (identifier: string) => {
    await Notifications.cancelScheduledNotificationAsync(identifier)
  }

  /**
   * @brief Cancels all scheduled notifications.
   */
  cancelAllNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync()
  }

  async registerAll() {
    if (this.isPushDisabledByUser()) return

    const { registerSystemNotifications } = await import('./system')
    // const { registerCustomNotifications } = await import('./custom')

    await registerSystemNotifications()
    // await registerCustomNotifications()
  }
}
