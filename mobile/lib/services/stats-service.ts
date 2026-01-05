import { useDatabaseStore } from '@/stores/database-store'
import type { HeatMapData, HeatMapCell, HeatMapQuery, MoodStats, TagStats } from '@/types/stats'

/**
 * Stats Service
 * Handles all statistics-related database operations
 */

class StatsService {
  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Get mood color based on mood key
   */
  private getMoodColor(moodKey?: string): string {
    const moodColors: Record<string, string> = {
      joy: '#FFD93D', // 愉悦 - 黄色
      anger: '#FF6B6B', // 愤怒 - 红色
      sadness: '#4ECDC4', // 悲伤 - 青色
      calm: '#95E1D3', // 平静 - 绿色
      anxiety: '#FFA07A', // 焦虑 - 橙色
      focus: '#6C5CE7', // 专注 - 紫色
      tired: '#A8A8A8', // 疲惫 - 灰色
      neutral: '#E0E0E0', // 中性 - 浅灰
    }
    return moodColors[moodKey || '#E0E0E0']
  }

  /**
   * Get date range for a month
   */
  private getMonthDateRange(year: number, month: number): { startDate: string; endDate: string } {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    return { startDate, endDate }
  }

  // ============================================================================
  // HeatMap Operations
  // ============================================================================

  /**
   * Get heat map data for a date range
   */
  async getHeatMapData(query: HeatMapQuery): Promise<HeatMapData> {
    const { startDate, endDate } = query

    // Get all diaries in the date range
    const diaries = await useDatabaseStore.getState().queryAll<any>(
      `SELECT date, mood_key, mood_score
       FROM diaries
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC`,
      [startDate, endDate]
    )

    // Create a map of date to mood data
    const dateMoodMap = new Map<string, { moodKey?: string; moodScore?: number }>()
    diaries.forEach(diary => {
      dateMoodMap.set(diary.date, {
        moodKey: diary.mood_key,
        moodScore: diary.mood_score,
      })
    })

    // Generate all dates in the range
    const cells: HeatMapCell[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const moodData = dateMoodMap.get(dateStr)

      cells.push({
        date: dateStr,
        moodKey: moodData?.moodKey,
        moodScore: moodData?.moodScore,
        color: this.getMoodColor(moodData?.moodKey),
      })
    }

    return {
      startDate,
      endDate,
      cells,
    }
  }

  // ============================================================================
  // Tag Statistics
  // ============================================================================

  /**
   * Get all tags with their usage count
   */
  async getAllTags(): Promise<TagStats[]> {
    const rows = await useDatabaseStore
      .getState()
      .queryAll<{ tags: string }>(`SELECT tags FROM memos WHERE is_deleted = 0 AND tags != '[]'`)

    const tagCountMap = new Map<string, number>()

    rows.forEach(row => {
      if (row.tags) {
        try {
          const tags = JSON.parse(row.tags)
          tags.forEach((tag: string) => {
            const count = tagCountMap.get(tag) || 0
            tagCountMap.set(tag, count + 1)
          })
        } catch (error) {
          console.warn('Failed to parse tags:', error)
        }
      }
    })

    // Convert to array and sort by count
    const tagStats: TagStats[] = Array.from(tagCountMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)

    return tagStats
  }

  /**
   * Get mood distribution for a date range
   */
  async getMoodDistribution(startDate: string, endDate: string): Promise<MoodStats[]> {
    const diaries = await useDatabaseStore.getState().queryAll<any>(
      `SELECT mood_key, COUNT(*) as count
       FROM diaries
       WHERE date >= ? AND date <= ? AND mood_key IS NOT NULL
       GROUP BY mood_key
       ORDER BY count DESC`,
      [startDate, endDate]
    )

    const totalCount = diaries.reduce((sum, d) => sum + d.count, 0)

    return diaries.map(d => ({
      moodKey: d.mood_key,
      count: d.count,
      percentage: totalCount > 0 ? (d.count / totalCount) * 100 : 0,
      color: this.getMoodColor(d.mood_key),
    }))
  }

  /**
   * Get top tags for a date range
   */
  async getTopTags(startDate: string, endDate: string, limit: number = 10): Promise<TagStats[]> {
    const rows = await useDatabaseStore.getState().queryAll<{ tags: string }>(
      `SELECT tags
       FROM memos
       WHERE date(created_at / 1000, 'unixepoch', 'localtime') >= ?
         AND date(created_at / 1000, 'unixepoch', 'localtime') <= ?
         AND is_deleted = 0
         AND tags != '[]'`,
      [startDate, endDate]
    )

    const tagCountMap = new Map<string, number>()

    rows.forEach(row => {
      if (row.tags) {
        try {
          const tags = JSON.parse(row.tags)
          tags.forEach((tag: string) => {
            const count = tagCountMap.get(tag) || 0
            tagCountMap.set(tag, count + 1)
          })
        } catch (error) {
          console.warn('Failed to parse tags:', error)
        }
      }
    })

    // Convert to array, sort by count, and limit
    const tagStats: TagStats[] = Array.from(tagCountMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return tagStats
  }
}

// Export singleton instance
export const statsService = new StatsService()
