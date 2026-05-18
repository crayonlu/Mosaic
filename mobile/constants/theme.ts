import {
  CLEAN_SLATE,
  CLEAN_SLATE_SHADOWS,
  CLEAN_SLATE_TYPOGRAPHY,
  QUIET_PAPER,
  QUIET_PAPER_SHADOWS,
  QUIET_PAPER_TYPOGRAPHY,
  type ThemeShadowSet,
  type ThemeTypographySet,
} from '@mosaic/utils'
import { Platform } from 'react-native'

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
  shadows: ThemeShadowSet
  typography: ThemeTypographySet
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

export const QuietPaperTheme: Theme = {
  background: QUIET_PAPER.background,
  surface: QUIET_PAPER.surface,
  surfaceMuted: withAlpha(QUIET_PAPER.text, 0.04),
  surfaceStrong: withAlpha(QUIET_PAPER.text, 0.08),
  text: QUIET_PAPER.text,
  textSecondary: QUIET_PAPER.textSecondary,
  textTertiary: withAlpha(QUIET_PAPER.text, 0.52),
  border: QUIET_PAPER.border,
  borderStrong: withAlpha(QUIET_PAPER.text, 0.18),
  spacing: 16,
  primary: QUIET_PAPER.primary,
  primaryAccent: QUIET_PAPER.primaryAccent,
  onPrimary: QUIET_PAPER.onPrimary,
  link: QUIET_PAPER.link,
  mark: QUIET_PAPER.mark,
  success: QUIET_PAPER.success,
  error: QUIET_PAPER.error,
  warning: QUIET_PAPER.warning,
  info: QUIET_PAPER.info,
  overlay: QUIET_PAPER.overlay,
  semantic: {
    successSoft: withAlpha(QUIET_PAPER.success, 0.14),
    errorSoft: withAlpha(QUIET_PAPER.error, 0.14),
    warningSoft: withAlpha(QUIET_PAPER.warning, 0.16),
    infoSoft: withAlpha(QUIET_PAPER.info, 0.14),
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
  shadows: QUIET_PAPER_SHADOWS,
  typography: QUIET_PAPER_TYPOGRAPHY,
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

export const CleanSlateTheme: Theme = {
  background: CLEAN_SLATE.background,
  surface: CLEAN_SLATE.surface,
  surfaceMuted: withAlpha(CLEAN_SLATE.text, 0.05),
  surfaceStrong: withAlpha(CLEAN_SLATE.text, 0.1),
  text: CLEAN_SLATE.text,
  textSecondary: CLEAN_SLATE.textSecondary,
  textTertiary: withAlpha(CLEAN_SLATE.text, 0.36),
  border: CLEAN_SLATE.border,
  borderStrong: withAlpha(CLEAN_SLATE.text, 0.14),
  spacing: 16,
  primary: CLEAN_SLATE.primary,
  primaryAccent: CLEAN_SLATE.primaryAccent,
  onPrimary: CLEAN_SLATE.onPrimary,
  link: CLEAN_SLATE.link,
  mark: CLEAN_SLATE.mark,
  success: CLEAN_SLATE.success,
  error: CLEAN_SLATE.error,
  warning: CLEAN_SLATE.warning,
  info: CLEAN_SLATE.info,
  overlay: CLEAN_SLATE.overlay,
  semantic: {
    successSoft: withAlpha(CLEAN_SLATE.success, 0.12),
    errorSoft: withAlpha(CLEAN_SLATE.error, 0.12),
    warningSoft: withAlpha(CLEAN_SLATE.warning, 0.14),
    infoSoft: withAlpha(CLEAN_SLATE.info, 0.12),
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
  shadows: CLEAN_SLATE_SHADOWS,
  typography: CLEAN_SLATE_TYPOGRAPHY,
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
