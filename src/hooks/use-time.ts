import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/zh-cn'

dayjs.extend(utc)

dayjs.locale('zh-cn')

function getGreeting(): string {
  const hour = dayjs().hour()
  if (hour >= 6 && hour < 12) {
    return '早上好'
  } else if (hour >= 12 && hour < 14) {
    return '中午好'
  } else if (hour >= 14 && hour < 18) {
    return '下午好'
  } else {
    return '晚上好'
  }
}

export function useTime() {
  const now = dayjs()
  const formattedTime = now.format('HH:mm:ss')
  const formattedDate = now.utc().format('YYYY-MM-DD')
  const formattedDateWithWeek = now.format('M月D日 dddd')
  const greeting = getGreeting()
  return {
    formattedTime,
    formattedDate,
    formattedDateWithWeek,
    greeting,
  }
}
