import { LocalPushService, type RigsterSchedule } from '.'
import { diariesApi, memosApi } from '@mosaic/api'
import dayjs from 'dayjs'

// Lazy-load SchedulableTriggerInputTypes (not available in Expo Go SDK 53+)
let _dailyType: string | undefined

function getDailyType(): string {
  if (!_dailyType) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const notifications = require('expo-notifications') as typeof import('expo-notifications')
      _dailyType = notifications.SchedulableTriggerInputTypes.DAILY
    } catch {
      _dailyType = 'daily'
    }
  }
  return _dailyType
}

const systemPushSchedule: Record<string, RigsterSchedule> = {
  'archive-reminder': {
    content: {
      title: '这一天，辛苦啦',
      body: '睡前给心灵洗个澡，把今天的喜怒哀乐都收进盒子里吧。',
    },
    trigger: {
      hour: 21,
      minute: 0,
      type: getDailyType() as any,
    },
  },
  'memo-reminder': {
    content: {
      title: '留住今天的碎片',
      body: '好记性不如烂笔头，别让今天那些闪光的瞬间偷偷溜走呀。',
    },
    trigger: {
      hour: 21,
      minute: 0,
      type: getDailyType() as any,
    },
  },
}

const pushService = LocalPushService.getInstance()
const today = dayjs().format('YYYY-MM-DD')

const isArchivedToday = async () => {
  const data = await diariesApi.get(today)
  return !!data
}

const isMemoedToday = async () => {
  const data = await memosApi.getByDate(today)
  return data.length > 0
}

export const registerSystemNotifications = async () => {
  const [archived, memoed] = await Promise.all([isArchivedToday(), isMemoedToday()])

  if (!archived && memoed) {
    await pushService.registerNotification(
      systemPushSchedule['archive-reminder'].content,
      systemPushSchedule['archive-reminder'].trigger
    )
  }

  if (!memoed) {
    await pushService.registerNotification(
      systemPushSchedule['memo-reminder'].content,
      systemPushSchedule['memo-reminder'].trigger
    )
  }
}
