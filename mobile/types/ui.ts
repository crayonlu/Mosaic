/**
 * UI Component Types
 * Animation, Tab Bar and other UI elements
 */

export type AnimationType = 'spring' | 'timing' | 'decay'

export interface AnimationConfig {
  type: AnimationType
  duration?: number
  delay?: number
  dampingRatio?: number
  stiffness?: number
}

export interface TabItem {
  name: string
  key: string
  screen: string
  icon: {
    focused: string
    unfocused: string
  }
  label: string
  badge?: number
}
