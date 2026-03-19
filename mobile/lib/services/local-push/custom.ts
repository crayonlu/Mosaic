import { mmkv } from '@/lib/storage/mmkv'
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
  getAllPushes(): CustomPushData[] {
    try {
      const jsonValue = mmkv.getString(STORAGE_KEY)
      return jsonValue != null ? JSON.parse(jsonValue) : []
    } catch (e) {
      console.error('Failed to fetch pushes', e)
      return []
    }
  }

  saveCustomPush(data: CustomPushData) {
    try {
      const list = this.getAllPushes()
      const index = list.findIndex(item => item.name === data.name)

      if (index > -1) {
        list[index] = data
      } else {
        list.push(data)
      }

      mmkv.set(STORAGE_KEY, JSON.stringify(list))
    } catch (e) {
      console.error('Save failed', e)
    }
  }

  deleteOneCustomPush(name: string) {
    try {
      const list = this.getAllPushes()
      const newList = list.filter(item => item.name !== name)
      mmkv.set(STORAGE_KEY, JSON.stringify(newList))
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  hasCustomPush(name: string): boolean {
    const list = this.getAllPushes()
    return list.some(item => item.name === name)
  }

  clearAllPushes() {
    mmkv.remove(STORAGE_KEY)
  }
}

export const customPushStorage = new CustomPushStorage()

export const registerCustomNotifications = async () => {
  const pushes = customPushStorage.getAllPushes()
  for (const data of pushes) {
    const triggerDate = new Date(data.trigger)
    const year = triggerDate.getFullYear()
    const month = triggerDate.getMonth() + 1
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
