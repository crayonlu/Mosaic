/**
 * Utility Functions
 * Common helper functions used across the app
 */

import { Dimensions, PixelRatio, Platform } from 'react-native'
import { TagColors } from '@/constants/common'
import type { HeatmapData } from '@/types'

// ============================================================================
// Responsive Design Utilities
// ============================================================================
const { width, height } = Dimensions.get('window')

const wp = (percentage: number): number => {
  const dimension = width < height ? width : height
  return PixelRatio.roundToNearestPixel((dimension * percentage) / 100)
}

const hp = (percentage: number): number => {
  const dimension = width < height ? height : width
  return PixelRatio.roundToNearestPixel((dimension * percentage) / 100)
}

/**
 * Get device specific width/height percentages
 */
export const responsive = {
  width,
  height,
  wp,
  hp,
  /** Is the device in portrait orientation */
  isPortrait: height > width,
  /** Is the device in landscape orientation */
  isLandscape: width > height,
  /** Is this a small device (iPhone SE, etc.) */
  isSmallDevice: width < 375,
  /** Is this a tablet */
  isTablet: width >= 768,
  /** Scale a value based on screen width */
  scale: (value: number, baseWidth: number = 375) => (width / baseWidth) * value,
}

// ============================================================================
// Typography Utilities
// ============================================================================
export const typography = {
  /** Capitalize first letter of each word */
  capitalize: (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  },
  /** Truncate text with ellipsis */
  truncate: (str: string, maxLength: number): string => {
    if (str.length <= maxLength) return str
    return str.slice(0, maxLength - 3) + '...'
  },
  /** Count words in a string */
  wordCount: (str: string): number => {
    const trimmed = str.trim()
    if (trimmed === '') return 0
    return trimmed.split(/\s+/).length
  },
  /** Count characters (excluding whitespace) */
  charCount: (str: string): number => str.replace(/\s/g, '').length,
}

// ============================================================================
// Date Utilities
// ============================================================================
export const dateUtils = {
  /** Format date to localized string */
  format: (date: string | Date, format: 'full' | 'short' = 'short'): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const options: Intl.DateTimeFormatOptions =
      format === 'full'
        ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: 'numeric' }
    return d.toLocaleDateString('zh-CN', options)
  },
  /** Get relative time (e.g., "2 hours ago") */
  relativeTime: (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    // Return formatted date string
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    return `${year}年${month}月${day}日`
  },
  /** Get today's date string in YYYY-MM-DD format */
  today: (): string => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  },
  /** Check if date is today */
  isToday: (date: string | Date): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date
    const today = new Date()
    return d.toDateString() === today.toDateString()
  },
  /** Get start of day for a date */
  startOfDay: (date: string | Date): Date => {
    const d = typeof date === 'string' ? new Date(date) : date
    d.setHours(0, 0, 0, 0)
    return d
  },
  /** Get end of day for a date */
  endOfDay: (date: string | Date): Date => {
    const d = typeof date === 'string' ? new Date(date) : date
    d.setHours(23, 59, 59, 999)
    return d
  },
  /** Get week number of the year */
  getWeekNumber: (date: string | Date): number => {
    const d = typeof date === 'string' ? new Date(date) : date
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 4 - (d.getDay() || 7))
    const yearStart = new Date(d.getFullYear(), 0, 1)
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7))
  },
}

// ============================================================================
// Color Utilities
// ============================================================================
export const colorUtils = {
  /** Assign a consistent color to a tag based on its name */
  getTagColor: (tag: string): string => {
    const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return TagColors[index % TagColors.length]
  },
  /** Lighten a color (hex) */
  lighten: (hex: string, amount: number): string => {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, (num >> 16) + amount)
    const g = Math.min(255, ((num >> 8) & 0x00ff) + amount)
    const b = Math.min(255, (num & 0x0000ff) + amount)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  },
  /** Darken a color (hex) */
  darken: (hex: string, amount: number): string => {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (num >> 16) - amount)
    const g = Math.max(0, ((num >> 8) & 0x00ff) - amount)
    const b = Math.max(0, (num & 0x0000ff) - amount)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  },
  /** Get random color */
  randomColor: (): string => {
    const letters = '0123456789ABCDEF'
    let color = '#'
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)]
    }
    return color
  },
}

// ============================================================================
// String Utilities
// ============================================================================
export const stringUtils = {
  /** Generate a unique ID */
  generateId: (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  /** Escape HTML special characters */
  escapeHtml: (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  },
  /** Check if string is empty or whitespace */
  isEmpty: (str: string | undefined | null): boolean => {
    return !str || str.trim().length === 0
  },
  /** Extract hashtags from text */
  extractHashtags: (text: string): string[] => {
    const hashtagRegex = /#(\w+[\u4e00-\u9fa5\w]*)/g
    const matches = text.match(hashtagRegex)
    return matches ? matches.map(tag => tag.slice(1)) : []
  },
  /** Extract URLs from text */
  extractUrls: (text: string): string[] => {
    const urlRegex =
      /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi
    return text.match(urlRegex) || []
  },
}

// ============================================================================
// Validation Utilities
// ============================================================================
export const validation = {
  email: (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  },
  url: (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },
  fileExtension: (filename: string, allowedExtensions: string[]): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext ? allowedExtensions.includes(ext) : false
  },
}

// ============================================================================
// File Utilities
// ============================================================================
export const fileUtils = {
  /** Get file extension */
  getExtension: (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || ''
  },
  /** Get file type */
  getType: (filename: string): 'image' | 'video' | 'audio' | 'file' => {
    const ext = fileUtils.getExtension(filename)
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']
    const videoExts = ['mp4', 'mov', 'avi', 'webm']
    const audioExts = ['mp3', 'wav', 'm4a', 'aac']
    if (imageExts.includes(ext)) return 'image'
    if (videoExts.includes(ext)) return 'video'
    if (audioExts.includes(ext)) return 'audio'
    return 'file'
  },
  /** Format file size */
  formatSize: (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  },
  /** Check if file is valid */
  isValidFile: (filename: string, maxSize: number): boolean => {
    // This is a placeholder - actual file size would come from the file object
    return filename.length > 0
  },
}

// ============================================================================
// Array Utilities
// ============================================================================
export const arrayUtils = {
  /** Remove duplicates from array */
  unique: <T>(arr: T[]): T[] => [...new Set(arr)],
  /** Group array by key */
  groupBy: <T>(arr: T[], key: keyof T): Record<string, T[]> => {
    return arr.reduce((acc, item) => {
      const groupKey = String(item[key])
      if (!acc[groupKey]) acc[groupKey] = []
      acc[groupKey].push(item)
      return acc
    }, {} as Record<string, T[]>)
  },
  /** Sort array by date */
  sortByDate: <T extends { createdAt: string | Date }>(
    arr: T[],
    order: 'asc' | 'desc' = 'desc'
  ): T[] => {
    return [...arr].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return order === 'asc' ? dateA - dateB : dateB - dateA
    })
  },
  /** Chunk array into smaller arrays */
  chunk: <T>(arr: T[], size: number): T[][] => {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size))
    }
    return result
  },
}

// ============================================================================
// Heatmap Utilities
// ============================================================================
export const heatmapUtils = {
  /** Generate heatmap data from memos */
  generate: (memos: { createdAt: string }[]): HeatmapData => {
    const dayCounts: Record<string, number> = {}

    memos.forEach(memo => {
      const date = memo.createdAt.split('T')[0]
      dayCounts[date] = (dayCounts[date] || 0) + 1
    })

    // Get max count
    const maxCount = Math.max(...Object.values(dayCounts), 0)

    // Generate grid entries
    const days = Object.entries(dayCounts).map(([date, count]) => {
      // Calculate activity level (0-4)
      let level: 0 | 1 | 2 | 3 | 4 = 0
      if (count > 0) {
        const ratio = count / maxCount
        if (ratio >= 0.75) level = 4
        else if (ratio >= 0.5) level = 3
        else if (ratio >= 0.25) level = 2
        else level = 1
      }

      return { date, count, level }
    })

    return {
      days,
      maxCount,
      totalMemos: memos.length,
      streak: 0, // TODO: calculate streak
    }
  },
}

// ============================================================================
// Platform Utilities
// ============================================================================
export const platformUtils = {
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isWeb: Platform.OS === 'web',
  /** Get safe area inset helper */
  getSafeAreaInsets: () => {
    // This would use react-native-safe-area-context
    return { top: 0, bottom: 0, left: 0, right: 0 }
  },
}

// ============================================================================
// Debounce utility
// ============================================================================
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// ============================================================================
// Throttle utility
// ============================================================================
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
