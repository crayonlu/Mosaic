import { useTheme } from '@/hooks/useTheme'
import { Switch } from 'react-native'

export interface SwitchBtnProps {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
}

export function SwitchBtn({ value, onValueChange, disabled }: SwitchBtnProps) {
  const { theme } = useTheme()

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.border, true: theme.primary }}
      thumbColor={theme.background}
    />
  )
}
