import { QueryError } from '@/lib/database/errors'
import { useDatabaseStore } from '@/lib/database/state-manager'
import { generateDateRange } from '@/lib/utils/time'
import type { HeatMapCell, HeatMapData, HeatMapQuery, MoodStats, TagStats } from '@/types/stats'

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

  // ============================================================================
  // HeatMap Operations
  // ============================================================================

  /**
   * Get heat map data for a date range
   */
  async getHeatMapData(query: HeatMapQuery): Promise<HeatMapData> {
    const { startDate, endDate } = query

    // Get all diaries in the date range
    const rows = await useDatabaseStore
      .getState()
      .queryAll<{ mood_key: string; mood_score: number }>(
        `SELECT date, mood_key, mood_score
       FROM diaries
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC`,
        [startDate, endDate]
      )

    // Create a map of date to mood data
    const dateMoodMap = new Map<string, { moodKey?: string; moodScore?: number }>()
    rows.forEach((diary: any) => {
      dateMoodMap.set(diary.date, {
        moodKey: diary.mood_key,
        moodScore: diary.mood_score,
      })
    })

    // Generate all dates in the range
    const dates = generateDateRange(startDate, endDate)

    // Create heat map cells
    const cells: HeatMapCell[] = []
    for (const dateStr of dates) {
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
   * Get all unique tags with their usage count
   */
  async getAllTags(): Promise<TagStats[]> {
    try {
      const rows = await useDatabaseStore.getState().queryAll<{
        tags: string
      }>(`SELECT DISTINCT tags FROM memos WHERE is_deleted = 0 AND tags != '[]'`)

      const tagCountMap = new Map<string, number>()

      rows.forEach((row: any) => {
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
    } catch (error) {
      throw new QueryError(
        `Failed to get all tags: ${error instanceof Error ? error.message : String(error)}`,
        "SELECT DISTINCT tags FROM memos WHERE is_deleted = 0 AND tags != '[]'",
        [],
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get mood distribution for a date range
   */
  async getMoodDistribution(startDate: string, endDate: string): Promise<MoodStats[]> {
    try {
      const diaries = await useDatabaseStore.getState().queryAll<{ mood_key: string }>(
        `SELECT mood_key, COUNT(*) as count
         FROM diaries
         WHERE date >= ? AND date <= ? AND mood_key IS NOT NULL
         GROUP BY mood_key
         ORDER BY count DESC`,
        [startDate, endDate]
      )

      const totalCount = diaries.reduce((sum: number, d: any) => sum + d.count, 0)

      return diaries.map((d: any) => ({
        moodKey: d.mood_key,
        count: d.count,
        percentage: totalCount > 0 ? (d.count / totalCount) * 100 : 0,
        color: this.getMoodColor(d.mood_key),
      }))
    } catch (error) {
      throw new QueryError(
        `Failed to get mood distribution: ${error instanceof Error ? error.message : String(error)}`,
        'SELECT mood_key, COUNT(*) as count FROM diaries WHERE date >= ? AND date <= ? AND mood_key IS NOT NULL GROUP BY mood_key ORDER BY count DESC',
        [startDate, endDate],
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get top tags for a date range
   */
  async getTopTags(startDate: string, endDate: string, limit: number = 10): Promise<TagStats[]> {
    try {
      const rows = await useDatabaseStore.getState().queryAll<{ tags: string; created_at: number }>(
        `SELECT tags, created_at
         FROM memos
         WHERE date(created_at / 1000, 'unixepoch', 'localtime') >= ?
           AND date(created_at / 1000, 'unixepoch', 'localtime') <= ?
           AND is_deleted = 0
           AND tags != '[]'
         ORDER BY created_at DESC`,
        [startDate, endDate]
      )

      const tagCountMap = new Map<string, number>()

      rows.forEach((row: any) => {
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
    } catch (error) {
      throw new QueryError(
        `Failed to get top tags: ${error instanceof Error ? error.message : String(error)}`,
        "SELECT tags, created_at FROM memos WHERE date(created_at / 1000, 'unixepoch', 'localtime') >= ? AND date(created_at / 1000, 'unixepoch', 'localtime') <= ? AND is_deleted = 0 AND tags != '[]' ORDER BY created_at DESC",
        [startDate, endDate],
        error instanceof Error ? error : undefined
      )
    }
  }
}

// Export singleton instance
export const statsService = new StatsService()
