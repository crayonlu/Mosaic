import { useThemeStore } from '@/stores/themeStore'
import { Check, ChevronDown } from 'lucide-react-native'
import { useState } from 'react'
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

export interface SelectOption {
  label: string
  value: string
}

export interface SelectProps {
  options: SelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  size?: 'small' | 'medium'
}

export function Select({
  options,
  value,
  onValueChange,
  placeholder = '请选择',
  size = 'medium',
}: SelectProps) {
  const { theme } = useThemeStore()
  const [isOpen, setIsOpen] = useState(false)

  const selectedOption = options.find(opt => opt.value === value)
  const displayText = selectedOption?.label || placeholder

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue)
    setIsOpen(false)
  }

  const getPaddingVertical = () => {
    return size === 'small' ? theme.spacingScale.small : theme.spacingScale.medium
  }

  const getPaddingHorizontal = () => {
    return size === 'small' ? theme.spacingScale.medium : theme.spacingScale.large
  }

  const getFontSize = () => {
    return size === 'small' ? theme.typography.caption : theme.typography.body
  }

  return (
    <View style={styles.container}>
      {/* Select Trigger */}
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            backgroundColor: theme.surfaceMuted,
            borderColor: isOpen ? theme.border : 'transparent',
            borderWidth: isOpen ? StyleSheet.hairlineWidth : 0,
            paddingVertical: getPaddingVertical(),
            paddingHorizontal: getPaddingHorizontal(),
            borderRadius: theme.radius.medium,
          },
        ]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            {
              color: selectedOption ? theme.text : theme.textSecondary,
              fontSize: getFontSize(),
            },
          ]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <ChevronDown size={16} color={theme.textSecondary} strokeWidth={2} />
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: theme.surface,
                    borderColor: 'transparent',
                    borderRadius: theme.radius.large,
                  },
                ]}
              >
                {options.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      {
                        borderBottomColor: theme.border,
                        borderBottomWidth:
                          index === options.length - 1 ? 0 : StyleSheet.hairlineWidth,
                        paddingHorizontal: theme.spacing,
                        paddingVertical: theme.spacingScale.medium,
                      },
                    ]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: theme.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.value === value && (
                      <Check size={16} color={theme.primary} strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minWidth: 80,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  triggerText: {
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  dropdown: {
    width: '100%',
    overflow: 'hidden',
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
