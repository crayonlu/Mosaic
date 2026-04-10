import { QUIET_PAPER_DARK, QUIET_PAPER_LIGHT } from '@mosaic/utils'
import { Platform } from 'react-native'

export type ThemeMode = 'light' | 'dark'

export interface Theme {
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
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
  fontFamilySans: string
  fontFamilyMono: string
}

export const LightTheme: Theme = {
  background: QUIET_PAPER_LIGHT.background,
  surface: QUIET_PAPER_LIGHT.surface,
  text: QUIET_PAPER_LIGHT.text,
  textSecondary: QUIET_PAPER_LIGHT.textSecondary,
  border: QUIET_PAPER_LIGHT.border,
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
  text: QUIET_PAPER_DARK.text,
  textSecondary: QUIET_PAPER_DARK.textSecondary,
  border: QUIET_PAPER_DARK.border,
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
  fontFamilySans:
    Platform.select({
      ios: 'PingFang SC',
      android: 'NotoSansSC-Regular',
      default: 'System',
    }) || 'System',
  fontFamilyMono:
    Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) || 'monospace',
}
