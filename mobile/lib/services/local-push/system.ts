import i18n from '@/lib/i18n'
import { diariesApi, memosApi } from '@mosaic/api'
import dayjs from 'dayjs'
import { LocalPushService, type RigsterSchedule } from '.'

// Lazy-load SchedulableTriggerInputTypes (not available in Expo Go)
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
      title: i18n.t('localPush.dayEndTitle'),
      body: i18n.t('localPush.dayEndBody'),
    },
    trigger: {
      hour: 21,
      minute: 0,
      type: getDailyType() as any,
    },
  },
  'memo-reminder': {
    content: {
      title: i18n.t('localPush.reminderTitle'),
      body: i18n.t('localPush.reminderBody'),
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
      systemPushSchedule['archive-reminder'].trigger,
      'archive-reminder'
    )
  } else {
    await pushService.cancelNotification('archive-reminder')
  }

  if (!memoed) {
    await pushService.registerNotification(
      systemPushSchedule['memo-reminder'].content,
      systemPushSchedule['memo-reminder'].trigger,
      'memo-reminder'
    )
  } else {
    await pushService.cancelNotification('memo-reminder')
  }
}
