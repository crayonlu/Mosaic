import {
  CLEAN_SLATE_DARK,
  CLEAN_SLATE_LIGHT,
  QUIET_PAPER_DARK,
  QUIET_PAPER_LIGHT,
} from '@mosaic/utils'
import { Platform } from 'react-native'

export type ThemeMode = 'light' | 'dark'
export type ThemeName = 'quietPaper' | 'cleanSlate'

export interface Theme {
  background: string
  surface: string
  surfaceMuted: string
  surfaceStrong: string
  text: string
  textSecondary: string
  textTertiary: string
  border: string
  borderStrong: string
  spacing: number
  primary: string
  primaryAccent: string
  onPrimary: string
  link: string
  mark: string
  success: string
  error: string
  warning: string
  info: string
  overlay: string
  semantic: {
    successSoft: string
    errorSoft: string
    warningSoft: string
    infoSoft: string
  }
  radius: {
    small: number
    medium: number
    large: number
    pill: number
  }
  spacingScale: {
    xsmall: number
    small: number
    medium: number
    large: number
    xlarge: number
    xxlarge: number
    xxxlarge: number
  }
  typography: {
    caption: number
    body: number
    bodyLarge: number
    title: number
    titleLarge: number
  }
  state: {
    disabledOpacity: number
    pressedOpacity: number
  }
  fontFamilySans: string
  fontFamilyMono: string
}

const withAlpha = (hex: string, alpha: number) => {
  const cleanHex = hex.replace('#', '')
  const normalizedHex =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map(char => char + char)
          .join('')
      : cleanHex

  if (normalizedHex.length !== 6) {
    return `rgba(0, 0, 0, ${alpha})`
  }

  const r = Number.parseInt(normalizedHex.slice(0, 2), 16)
  const g = Number.parseInt(normalizedHex.slice(2, 4), 16)
  const b = Number.parseInt(normalizedHex.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const LightTheme: Theme = {
  background: QUIET_PAPER_LIGHT.background,
  surface: QUIET_PAPER_LIGHT.surface,
  surfaceMuted: withAlpha(QUIET_PAPER_LIGHT.text, 0.04),
  surfaceStrong: withAlpha(QUIET_PAPER_LIGHT.text, 0.08),
  text: QUIET_PAPER_LIGHT.text,
  textSecondary: QUIET_PAPER_LIGHT.textSecondary,
  textTertiary: withAlpha(QUIET_PAPER_LIGHT.text, 0.52),
  border: QUIET_PAPER_LIGHT.border,
  borderStrong: withAlpha(QUIET_PAPER_LIGHT.text, 0.18),
  spacing: 16,
  primary: QUIET_PAPER_LIGHT.primary,
  primaryAccent: QUIET_PAPER_LIGHT.primaryAccent,
  onPrimary: QUIET_PAPER_LIGHT.onPrimary,
  link: QUIET_PAPER_LIGHT.link,
  mark: QUIET_PAPER_LIGHT.mark,
  success: QUIET_PAPER_LIGHT.success,
  error: QUIET_PAPER_LIGHT.error,
  warning: QUIET_PAPER_LIGHT.warning,
  info: QUIET_PAPER_LIGHT.info,
  overlay: QUIET_PAPER_LIGHT.overlay,
  semantic: {
    successSoft: withAlpha(QUIET_PAPER_LIGHT.success, 0.14),
    errorSoft: withAlpha(QUIET_PAPER_LIGHT.error, 0.14),
    warningSoft: withAlpha(QUIET_PAPER_LIGHT.warning, 0.16),
    infoSoft: withAlpha(QUIET_PAPER_LIGHT.info, 0.14),
  },
  radius: {
    small: 8,
    medium: 12,
    large: 16,
    pill: 999,
  },
  spacingScale: {
    xsmall: 4,
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 20,
    xxlarge: 24,
    xxxlarge: 32,
  },
  typography: {
    caption: 12,
    body: 14,
    bodyLarge: 16,
    title: 17,
    titleLarge: 20,
  },
  state: {
    disabledOpacity: 0.42,
    pressedOpacity: 0.86,
  },
  fontFamilySans:
    Platform.select({
      ios: 'PingFang SC',
      android: 'NotoSansSC-Regular',
      default: 'System',
    }) || 'System',
  fontFamilyMono:
    Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) || 'monospace',
}

export const DarkTheme: Theme = {
  background: QUIET_PAPER_DARK.background,
  surface: QUIET_PAPER_DARK.surface,
  surfaceMuted: withAlpha(QUIET_PAPER_DARK.text, 0.08),
  surfaceStrong: withAlpha(QUIET_PAPER_DARK.text, 0.14),
  text: QUIET_PAPER_DARK.text,
  textSecondary: QUIET_PAPER_DARK.textSecondary,
  textTertiary: withAlpha(QUIET_PAPER_DARK.text, 0.54),
  border: QUIET_PAPER_DARK.border,
  borderStrong: withAlpha(QUIET_PAPER_DARK.text, 0.24),
  spacing: 16,
  primary: QUIET_PAPER_DARK.primary,
  primaryAccent: QUIET_PAPER_DARK.primaryAccent,
  onPrimary: QUIET_PAPER_DARK.onPrimary,
  link: QUIET_PAPER_DARK.link,
  mark: QUIET_PAPER_DARK.mark,
  success: QUIET_PAPER_DARK.success,
  error: QUIET_PAPER_DARK.error,
  warning: QUIET_PAPER_DARK.warning,
  info: QUIET_PAPER_DARK.info,
  overlay: QUIET_PAPER_DARK.overlay,
  semantic: {
    successSoft: withAlpha(QUIET_PAPER_DARK.success, 0.2),
    errorSoft: withAlpha(QUIET_PAPER_DARK.error, 0.2),
    warningSoft: withAlpha(QUIET_PAPER_DARK.warning, 0.22),
    infoSoft: withAlpha(QUIET_PAPER_DARK.info, 0.2),
  },
  radius: {
    small: 8,
    medium: 12,
    large: 16,
    pill: 999,
  },
  spacingScale: {
    xsmall: 4,
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 20,
    xxlarge: 24,
    xxxlarge: 32,
  },
  typography: {
    caption: 12,
    body: 14,
    bodyLarge: 16,
    title: 17,
    titleLarge: 20,
  },
  state: {
    disabledOpacity: 0.46,
    pressedOpacity: 0.88,
  },
  fontFamilySans:
    Platform.select({
      ios: 'PingFang SC',
      android: 'NotoSansSC-Regular',
      default: 'System',
    }) || 'System',
  fontFamilyMono:
    Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) || 'monospace',
}

export const CleanSlateLightTheme: Theme = {
  background: CLEAN_SLATE_LIGHT.background,
  surface: CLEAN_SLATE_LIGHT.surface,
  surfaceMuted: withAlpha(CLEAN_SLATE_LIGHT.text, 0.05),
  surfaceStrong: withAlpha(CLEAN_SLATE_LIGHT.text, 0.1),
  text: CLEAN_SLATE_LIGHT.text,
  textSecondary: CLEAN_SLATE_LIGHT.textSecondary,
  textTertiary: withAlpha(CLEAN_SLATE_LIGHT.text, 0.36),
  border: CLEAN_SLATE_LIGHT.border,
  borderStrong: withAlpha(CLEAN_SLATE_LIGHT.text, 0.14),
  spacing: 16,
  primary: CLEAN_SLATE_LIGHT.primary,
  primaryAccent: CLEAN_SLATE_LIGHT.primaryAccent,
  onPrimary: CLEAN_SLATE_LIGHT.onPrimary,
  link: CLEAN_SLATE_LIGHT.link,
  mark: CLEAN_SLATE_LIGHT.mark,
  success: CLEAN_SLATE_LIGHT.success,
  error: CLEAN_SLATE_LIGHT.error,
  warning: CLEAN_SLATE_LIGHT.warning,
  info: CLEAN_SLATE_LIGHT.info,
  overlay: CLEAN_SLATE_LIGHT.overlay,
  semantic: {
    successSoft: withAlpha(CLEAN_SLATE_LIGHT.success, 0.12),
    errorSoft: withAlpha(CLEAN_SLATE_LIGHT.error, 0.12),
    warningSoft: withAlpha(CLEAN_SLATE_LIGHT.warning, 0.14),
    infoSoft: withAlpha(CLEAN_SLATE_LIGHT.info, 0.12),
  },
  radius: {
    small: 6,
    medium: 8,
    large: 12,
    pill: 999,
  },
  spacingScale: {
    xsmall: 4,
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 20,
    xxlarge: 24,
    xxxlarge: 32,
  },
  typography: {
    caption: 12,
    body: 14,
    bodyLarge: 16,
    title: 17,
    titleLarge: 20,
  },
  state: {
    disabledOpacity: 0.38,
    pressedOpacity: 0.82,
  },
  fontFamilySans:
    Platform.select({
      ios: 'PingFang SC',
      android: 'NotoSansSC-Regular',
      default: 'System',
    }) || 'System',
  fontFamilyMono:
    Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) || 'monospace',
}

export const CleanSlateDarkTheme: Theme = {
  background: CLEAN_SLATE_DARK.background,
  surface: CLEAN_SLATE_DARK.surface,
  surfaceMuted: withAlpha(CLEAN_SLATE_DARK.text, 0.06),
  surfaceStrong: withAlpha(CLEAN_SLATE_DARK.text, 0.12),
  text: CLEAN_SLATE_DARK.text,
  textSecondary: CLEAN_SLATE_DARK.textSecondary,
  textTertiary: withAlpha(CLEAN_SLATE_DARK.text, 0.38),
  border: CLEAN_SLATE_DARK.border,
  borderStrong: withAlpha(CLEAN_SLATE_DARK.text, 0.2),
  spacing: 16,
  primary: CLEAN_SLATE_DARK.primary,
  primaryAccent: CLEAN_SLATE_DARK.primaryAccent,
  onPrimary: CLEAN_SLATE_DARK.onPrimary,
  link: CLEAN_SLATE_DARK.link,
  mark: CLEAN_SLATE_DARK.mark,
  success: CLEAN_SLATE_DARK.success,
  error: CLEAN_SLATE_DARK.error,
  warning: CLEAN_SLATE_DARK.warning,
  info: CLEAN_SLATE_DARK.info,
  overlay: CLEAN_SLATE_DARK.overlay,
  semantic: {
    successSoft: withAlpha(CLEAN_SLATE_DARK.success, 0.16),
    errorSoft: withAlpha(CLEAN_SLATE_DARK.error, 0.16),
    warningSoft: withAlpha(CLEAN_SLATE_DARK.warning, 0.18),
    infoSoft: withAlpha(CLEAN_SLATE_DARK.info, 0.16),
  },
  radius: {
    small: 6,
    medium: 8,
    large: 12,
    pill: 999,
  },
  spacingScale: {
    xsmall: 4,
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 20,
    xxlarge: 24,
    xxxlarge: 32,
  },
  typography: {
    caption: 12,
    body: 14,
    bodyLarge: 16,
    title: 17,
    titleLarge: 20,
  },
  state: {
    disabledOpacity: 0.38,
    pressedOpacity: 0.82,
  },
  fontFamilySans:
    Platform.select({
      ios: 'PingFang SC',
      android: 'NotoSansSC-Regular',
      default: 'System',
    }) || 'System',
  fontFamilyMono:
    Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) || 'monospace',
}
