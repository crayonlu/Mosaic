import AsyncStorage from '@react-native-async-storage/async-storage'
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

  /**
   * @brief Returns true if user disabled push notifications in app settings.
   */
  isPushDisabledByUser = async () => {
    const value = await AsyncStorage.getItem(STORAGE_KEY)
    return value === DISABLED_VALUE
  }

  /**
   * @brief Enable or disable app-level push switch stored locally.
   */
  setPushEnabled = async (enabled: boolean) => {
    if (enabled) {
      await AsyncStorage.removeItem(STORAGE_KEY)
      return
    }

    await AsyncStorage.setItem(STORAGE_KEY, DISABLED_VALUE)
    await Notifications.cancelAllScheduledNotificationsAsync()
  }

  /**
   * @brief Returns effective push status (system permission + app-level switch).
   */
  isPushEnabled = async () => {
    const [granted, disabledByUser] = await Promise.all([
      this.getNotificationPermissionStatus(),
      this.isPushDisabledByUser(),
    ])
    return granted && !disabledByUser
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
    if (await this.isPushDisabledByUser()) return

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
    if (await this.isPushDisabledByUser()) return

    const { registerSystemNotifications } = await import('./system')
    // const { registerCustomNotifications } = await import('./custom')

    await registerSystemNotifications()
    // await registerCustomNotifications()
  }
}
