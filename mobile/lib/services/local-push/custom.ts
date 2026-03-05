import AsyncStorage from '@react-native-async-storage/async-storage'
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types'
import { LocalPushService } from '.'

export type CustomPushData = {
  name: string // id
  title: string
  body: string
  trigger: string // YYYY-MM-DDTHH:mm
}

const STORAGE_KEY = 'mosaic_custom_push_list'

class CustomPushStorage {
  async getAllPushes(): Promise<CustomPushData[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY)
      return jsonValue != null ? JSON.parse(jsonValue) : []
    } catch (e) {
      console.error('Failed to fetch pushes', e)
      return []
    }
  }

  async saveCustomPush(data: CustomPushData) {
    try {
      const list = await this.getAllPushes()
      const index = list.findIndex(item => item.name === data.name)

      if (index > -1) {
        list[index] = data
      } else {
        list.push(data)
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch (e) {
      console.error('Save failed', e)
    }
  }

  async deleteOneCustomPush(name: string) {
    try {
      const list = await this.getAllPushes()
      const newList = list.filter(item => item.name !== name)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList))
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  async hasCustomPush(name: string): Promise<boolean> {
    const list = await this.getAllPushes()
    return list.some(item => item.name === name)
  }

  async clearAllPushes() {
    await AsyncStorage.removeItem(STORAGE_KEY)
  }
}

export const customPushStorage = new CustomPushStorage()

export const registerCustomNotifications = async () => {
  const pushes = await customPushStorage.getAllPushes()
  for (const data of pushes) {
    await customPushStorage.saveCustomPush(data)

    // Parse trigger date string (format: YYYY-MM-DDTHH:mm)
    const triggerDate = new Date(data.trigger)
    const year = triggerDate.getFullYear()
    const month = triggerDate.getMonth() + 1 // getMonth() returns 0-indexed
    const day = triggerDate.getDate()
    const hour = triggerDate.getHours()
    const minute = triggerDate.getMinutes()

    await LocalPushService.getInstance().registerNotification(
      { title: data.title, body: data.body },
      {
        type: SchedulableTriggerInputTypes.CALENDAR,
        year,
        month,
        day,
        hour,
        minute,
      }
    )
  }
}
