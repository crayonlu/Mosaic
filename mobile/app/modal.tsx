/**
 * Modal Screen
 * A modal screen for displaying overlay content
 */

import { useThemeStore } from '@/stores/themeStore'
import { router } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function ModalScreen() {
  const { theme } = useThemeStore()

  const handleClose = () => {
    router.back()
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.overlay }]}>
      <View
        style={[
          styles.modalContent,
          { backgroundColor: theme.surface, borderRadius: theme.radius.large },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Modal</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, { color: theme.text }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          <Text style={[styles.text, { color: theme.text }]}>This is a modal screen.</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  body: {
    padding: 20,
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
})
