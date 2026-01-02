import type { ResourcePreview } from './resource'

/**
 * Editor and Input Types
 * State management and UI controls for memo editing
 */

export interface InputState {
  value: string
  tags: string[]
  resources: ResourcePreview[]
  isExpanded: boolean
}

export interface EditorToolbarItem {
  key: string
  icon: string
  label: string
  action: () => void
}
