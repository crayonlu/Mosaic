import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'

dayjs.extend(weekOfYear)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)

export const dateUtils = {
  format: (date: string | Date | number, format: 'full' | 'short' = 'short'): string => {
    const d = dayjs(date)
    if (!d.isValid()) return '未知时间'

    return format === 'full' ? d.format('YYYY年MM月DD日 HH:mm') : d.format('YYYY年MM月DD日')
  },
  relativeTime: (date: string | Date | number): string => {
    const d = dayjs(date)
    if (!d.isValid()) return '未知时间'

    const now = dayjs()
    const diff = now.diff(d, 'second')

    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`

    return d.format('YYYY年MM月DD日')
  },
  today: (): string => {
    return dayjs().format('YYYY-MM-DD')
  },
  isToday: (date: string | Date | number): boolean => {
    const d = dayjs(date)
    const today = dayjs()
    return d.format('YYYY-MM-DD') === today.format('YYYY-MM-DD')
  },
  startOfDay: (date: string | Date | number): Date => {
    return dayjs(date).startOf('day').toDate()
  },
  endOfDay: (date: string | Date | number): Date => {
    return dayjs(date).endOf('day').toDate()
  },
  getWeekNumber: (date: string | Date | number): number => {
    return dayjs(date).week()
  },
}
