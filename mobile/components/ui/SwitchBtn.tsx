import { Switch } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export interface SwitchBtnProps {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
}

export function SwitchBtn({ value, onValueChange, disabled }: SwitchBtnProps) {
  const { theme } = useTheme();

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.border, true: theme.primary }}
      thumbColor={theme.background}
    />
  );
}