import { useTheme } from '@/hooks/useTheme'
import { useCallback, useEffect, useState } from 'react'
import { Switch } from 'react-native'

export interface SwitchBtnProps {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
}

export function SwitchBtn({ value, onValueChange, disabled }: SwitchBtnProps) {
  const { theme } = useTheme()
  const isDisabled = Boolean(disabled)
  const [localValue, setLocalValue] = useState(value)

  // Sync when parent value settles
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback((newValue: boolean) => {
    setLocalValue(newValue)   // instant UI
    onValueChange(newValue)   // notify parent (may be async)
  }, [onValueChange])

  return (
    <Switch
      value={localValue}
      onValueChange={handleChange}
      disabled={isDisabled}
      trackColor={{ false: theme.borderStrong, true: theme.primary }}
      thumbColor={localValue ? theme.surface : theme.background}
      ios_backgroundColor={theme.borderStrong}
      style={{ opacity: isDisabled ? theme.state.disabledOpacity : 1 }}
    />
  )
}
