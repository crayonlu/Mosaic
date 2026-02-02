export { DarkTheme, LightTheme, type Theme, type ThemeMode } from './theme'

export const APP = {
  NAME: 'Mosaic',
  DESCRIPTION: '重新整合破碎的自我 一次一个像素',
  VERSION: '1.0.0',
} as const

export const Screens = {
  HOME: 'index',
  ARCHIVE: 'archive',
  DIARIES: 'diaries',
  SEARCH: 'search',
  SETTINGS: 'settings',
  MEMO_DETAIL: 'memo/[id]',
} as const

// Tab bar configuration
export const Tabs = {
  items: [
    {
      name: 'Home',
      key: 'home',
      screen: Screens.HOME,
      icon: { focused: 'book-filled', unfocused: 'book' },
      label: '记录',
    },
    {
      name: 'Archive',
      key: 'archive',
      screen: Screens.ARCHIVE,
      icon: { focused: 'folder-open-filled', unfocused: 'folder-open' },
      label: '归档',
    },
    {
      name: 'Diaries',
      key: 'diaries',
      screen: 'diaries',
      icon: { focused: 'calendar-filled', unfocused: 'calendar' },
      label: '日记',
    },
    {
      name: 'Search',
      key: 'search',
      screen: 'search',
      icon: { focused: 'magnifying-glass-filled', unfocused: 'magnifying-glass' },
      label: '搜索',
    },
    {
      name: 'Settings',
      key: 'settings',
      screen: Screens.SETTINGS,
      icon: { focused: 'gear-solid-filled', unfocused: 'gear-solid' },
      label: '设置',
    },
  ],
} as const

// Storage keys
export const StorageKeys = {
  THEME_MODE: 'mosaic_theme_mode',
  SETTINGS: 'mosaic_settings',
  INPUT_STATE: 'mosaic_input_state',
} as const

// Default values
export const Defaults = {
  THEME: 'light',
  ITEMS_PER_PAGE: 20,
  EDITOR_HEIGHT: 120,
} as const

// File types and constraints
export const FileTypes = {
  IMAGES: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
  VIDEOS: ['mp4', 'mov', 'avi', 'webm'],
  AUDIO: ['mp3', 'wav', 'm4a', 'aac'],
  MAX_SIZE_IMAGE: 10 * 1024 * 1024, // 10MB
  MAX_SIZE_VIDEO: 100 * 1024 * 1024, // 100MB
} as const

// Animation durations (ms)
export const Animations = {
  SHORT: 150,
  MEDIUM: 300,
  LONG: 500,
  SLIDE_UP: 350,
  FADE: 200,
  SPRING: 400,
} as const

// Haptic feedback types
export const HapticTypes = {
  LIGHT: 'light',
  MEDIUM: 'medium',
  HEAVY: 'heavy',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const

// Date formats
export const DateFormats = {
  FULL: 'YYYY年MM月DD日 HH:mm',
  DATE_ONLY: 'YYYY年MM月DD日',
  TIME_ONLY: 'HH:mm',
  RELATIVE: 'relative',
} as const

// Tag colors for visual variety
export const TagColors = [
  'blue',
  'purple',
  'pink',
  'green',
  'orange',
  'cyan',
  'indigo',
  'teal',
  'rose',
  'amber',
] as const

// Mood/Emotion options
export const Moods = [
  { value: 'happy', emoji: '😊', label: '开心' },
  { value: 'calm', emoji: '😌', label: '平静' },
  { value: 'sad', emoji: '😢', label: '难过' },
  { value: 'anxious', emoji: '😰', label: '焦虑' },
  { value: 'excited', emoji: '🤩', label: '兴奋' },
  { value: 'tired', emoji: '😴', label: '疲惫' },
  { value: 'angry', emoji: '😠', label: '愤怒' },
  { value: 'neutral', emoji: '😐', label: '平淡' },
] as const

export type MoodKey =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'anxious'
  | 'calm'
  | 'excited'
  | 'tired'
  | 'neutral'

export interface MoodOption {
  value: MoodKey
  emoji: string
  label: string
  intensity: number
}

export const MOODS: MoodOption[] = [
  { value: 'happy', emoji: '😊', label: '开心', intensity: 1 },
  { value: 'calm', emoji: '😌', label: '平静', intensity: 1 },
  { value: 'sad', emoji: '😢', label: '难过', intensity: 1 },
  { value: 'anxious', emoji: '😰', label: '焦虑', intensity: 1 },
  { value: 'excited', emoji: '🤩', label: '兴奋', intensity: 1 },
  { value: 'tired', emoji: '😴', label: '疲惫', intensity: 1 },
  { value: 'angry', emoji: '😠', label: '愤怒', intensity: 1 },
  { value: 'neutral', emoji: '😐', label: '平淡', intensity: 1 },
]

export const MOOD_INTENSITY_LEVELS = 5

// Editor formatting options
export const EditorFormats = {
  BOLD: 'bold',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKETHROUGH: 'strikethrough',
  HEADING: 'heading',
  LIST: 'list',
  CHECKLIST: 'checklist',
  CODE: 'code',
  QUOTE: 'quote',
  DIVIDER: 'divider',
} as const

// Resource types
export const ResourceTypes = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file',
  LINK: 'link',
} as const

// Memo view modes
export const ViewModes = {
  TIMELINE: 'timeline',
  GRID: 'grid',
  LIST: 'list',
} as const

// Search filter types
export const SearchFilters = {
  ALL: 'all',
  CONTENT: 'content',
  TAGS: 'tags',
  RESOURCES: 'resources',
  MOOD: 'mood',
} as const


export type TimeRangeValue = 'year' | 'half' | 'quarter'
