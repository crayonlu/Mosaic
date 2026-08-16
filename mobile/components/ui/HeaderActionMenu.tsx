import { useThemeStore } from '@/stores/themeStore'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

export interface HeaderMenuItem {
  label: string
  icon?: ReactNode
  destructive?: boolean
  onPress: () => void
}

interface HeaderActionMenuProps {
  trigger: ReactNode
  items: HeaderMenuItem[]
  accessibilityLabel?: string
}

/** Dropdown menu anchored below the header trigger, opened from a header button. */
export function HeaderActionMenu({ trigger, items, accessibilityLabel }: HeaderActionMenuProps) {
  const { theme } = useThemeStore()
  const triggerRef = useRef<View>(null)
  const [open, setOpen] = useState(false)
  const [menuTop, setMenuTop] = useState(56)

  const handleOpen = () => {
    triggerRef.current?.measure((_x, _y, _w, h, _pageX, pageY) => {
      setMenuTop(pageY + h + 4)
      setOpen(true)
    })
  }

  const handlePressItem = (item: HeaderMenuItem) => {
    setOpen(false)
    item.onPress()
  }

  return (
    <View>
      <Pressable
        ref={triggerRef}
        onPress={handleOpen}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.trigger}
        accessibilityLabel={accessibilityLabel}
      >
        {trigger}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menu,
              {
                top: menuTop,
                backgroundColor: theme.surface,
                borderRadius: theme.radius.large,
                ...theme.shadows.medium,
              },
            ]}
          >
            {items.map(item => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [
                  styles.item,
                  {
                    paddingHorizontal: theme.spacingScale.medium,
                    paddingVertical: theme.spacingScale.medium,
                    opacity: pressed ? theme.state.pressedOpacity : 1,
                  },
                ]}
                onPress={() => handlePressItem(item)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                {item.icon ? <View style={styles.itemIcon}>{item.icon}</View> : null}
                <Text
                  style={[styles.itemLabel, { color: item.destructive ? theme.error : theme.text }]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  trigger: {
    padding: 4,
  },
  overlay: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    right: 16,
    minWidth: 168,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    marginRight: 10,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
})
