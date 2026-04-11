import { useTheme } from '@/hooks/useTheme'
import { Switch } from 'react-native'

export interface SwitchBtnProps {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
}

export function SwitchBtn({ value, onValueChange, disabled }: SwitchBtnProps) {
  const { theme } = useTheme()
  const isDisabled = Boolean(disabled)

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={isDisabled}
      trackColor={{ false: theme.borderStrong, true: theme.primary }}
      thumbColor={value ? theme.surface : theme.background}
      ios_backgroundColor={theme.borderStrong}
      style={{ opacity: isDisabled ? theme.state.disabledOpacity : 1 }}
    />
  )
}
