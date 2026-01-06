import dayjs from 'dayjs'

/**
 * 获取当前时间戳（毫秒）
 */
export function getCurrentTimestamp(): number {
  return dayjs().valueOf()
}

/**
 * 获取当前时间戳（秒）
 */
export function getCurrentUnixTimestamp(): number {
  return dayjs().unix()
}

/**
 * 生成唯一 ID（基于时间戳）
 */
export function generateTimestampId(prefix: string = ''): string {
  const timestamp = dayjs().valueOf()
  const random = Math.random().toString(36).substring(2, 11)
  return `${prefix}${timestamp}_${random}`
}

/**
 * 格式化时间戳为日期字符串
 */
export function formatTimestamp(timestamp: number, format: string = 'YYYY-MM-DD'): string {
  return dayjs(timestamp).format(format)
}

/**
 * 格式化时间戳为日期时间字符串
 */
export function formatDateTime(timestamp: number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(timestamp).format(format)
}

/**
 * 获取日期范围
 */
export function getDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const startDate = dayjs()
    .year(year)
    .month(month - 1)
    .date(1)
    .format('YYYY-MM-DD')
  const endDate = dayjs()
    .year(year)
    .month(month - 1)
    .endOf('month')
    .format('YYYY-MM-DD')
  return { startDate, endDate }
}

/**
 * 生成日期范围内的所有日期
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  let current = dayjs(startDate)
  const end = dayjs(endDate)

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current.format('YYYY-MM-DD'))
    current = current.add(1, 'day')
  }

  return dates
}

/**
 * 检查时间戳是否在指定范围内
 */
export function isTimestampInRange(timestamp: number, start: number, end: number): boolean {
  const ts = dayjs(timestamp)
  const startTime = dayjs(start)
  const endTime = dayjs(end)
  return ts.isSameOrAfter(startTime) && ts.isSameOrBefore(endTime)
}

/**
 * 计算时间差（毫秒）
 */
export function getTimeDifference(timestamp1: number, timestamp2: number): number {
  return Math.abs(dayjs(timestamp1).diff(dayjs(timestamp2)))
}

/**
 * 检查时间戳是否过期
 */
export function isTimestampExpired(timestamp: number, expiryMs: number): boolean {
  return dayjs().diff(dayjs(timestamp)) > expiryMs
}
