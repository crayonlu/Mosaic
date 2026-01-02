/**
 * useHaptics Hook
 * Provides haptic feedback functionality
 */

import * as Haptics from 'expo-haptics'
import { HapticTypes } from '@/constants/common'

export function useHaptics() {
  const trigger = (type: keyof typeof HapticTypes = 'MEDIUM') => {
    switch (type) {
      case 'LIGHT':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        break
      case 'MEDIUM':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        break
      case 'HEAVY':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        break
      case 'SUCCESS':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        break
      case 'WARNING':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        break
      case 'ERROR':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        break
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  }

  return {
    trigger,
    impact: Haptics.impactAsync,
    selection: Haptics.selectionAsync,
    notification: Haptics.notificationAsync,
  }
}
