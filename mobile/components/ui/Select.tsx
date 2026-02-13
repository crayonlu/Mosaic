import { useThemeStore } from '@/stores/theme-store'
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
    return size === 'small' ? 6 : 8
  }

  const getPaddingHorizontal = () => {
    return size === 'small' ? 10 : 12
  }

  const getFontSize = () => {
    return size === 'small' ? 13 : 14
  }

  return (
    <View style={styles.container}>
      {/* Select Trigger */}
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            paddingVertical: getPaddingVertical(),
            paddingHorizontal: getPaddingHorizontal(),
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
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                {options.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      {
                        borderBottomColor: theme.border,
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
    borderWidth: 1,
    borderRadius: 8,
    gap: 6,
  },
  triggerText: {
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  dropdown: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
