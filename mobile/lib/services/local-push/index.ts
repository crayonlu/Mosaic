import type {
  NotificationContentInput,
  SchedulableNotificationTriggerInput,
} from 'expo-notifications'
import * as Notifications from 'expo-notifications'
import { registerCustomNotifications } from './custom'
import { registerSystemNotifications } from './system'

export type RigsterSchedule = {
  content: NotificationContentInput
  trigger: SchedulableNotificationTriggerInput
}

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

  /**
   * @brief Schedules a local notification.
   * @param content Notification content.
   * @param trigger Notification trigger.
   */
  registerNotification = async (
    content: NotificationContentInput,
    trigger: SchedulableNotificationTriggerInput
  ) => {
    if (!this.getNotificationPermissionStatus()) {
      const isGranted = await this.requestNotificationPermission()
      if (!isGranted) throw new Error('Notification permission not granted')
    }
    await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    })
  }

  async registerAll() {
    registerSystemNotifications()
    registerCustomNotifications()
  }
}
