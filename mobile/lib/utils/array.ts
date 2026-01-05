import dayjs from 'dayjs'

export const arrayUtils = {
  unique: <T>(arr: T[]): T[] => [...new Set(arr)],
  groupBy: <T>(arr: T[], key: keyof T): Record<string, T[]> => {
    return arr.reduce(
      (acc, item) => {
        const groupKey = String(item[key])
        if (!acc[groupKey]) acc[groupKey] = []
        acc[groupKey].push(item)
        return acc
      },
      {} as Record<string, T[]>
    )
  },
  sortByDate: <T extends { createdAt: string | Date | number }>(
    arr: T[],
    order: 'asc' | 'desc' = 'desc'
  ): T[] => {
    return [...arr].sort((a, b) => {
      const dateA = dayjs(a.createdAt).valueOf()
      const dateB = dayjs(b.createdAt).valueOf()
      return order === 'asc' ? dateA - dateB : dateB - dateA
    })
  },
  chunk: <T>(arr: T[], size: number): T[][] => {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  },
}
