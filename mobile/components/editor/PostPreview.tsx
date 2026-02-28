import { Badge, DraggableImageGrid } from '@/components/ui'
import { getBearerAuthHeaders } from '@/lib/services/api-auth'
import { useThemeStore } from '@/stores/theme-store'
import { X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MarkdownRenderer } from './MarkdownRenderer'

interface PostPreviewProps {
  visible: boolean
  content: string
  images: string[]
  tags: string[]
  onClose: () => void
  onPost: () => void
}

export function PostPreview({ visible, content, images, tags, onClose, onPost }: PostPreviewProps) {
  const { theme } = useThemeStore()
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await getBearerAuthHeaders()
      setAuthHeaders(headers)
    }
    loadAuthHeaders()
  }, [])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <X size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>预览</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.content}>
          {content.trim() ? (
            <View style={styles.textContent}>
              <MarkdownRenderer content={content} />
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>无内容</Text>
          )}

          {images.length > 0 && (
            <View style={styles.imageGridContainer}>
              <DraggableImageGrid images={images} authHeaders={authHeaders} draggable={false} />
            </View>
          )}

          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map(tag => (
                <Badge key={tag} text={`#${tag}`} variant="outline" size="small" />
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  textContent: {
    flex: 1,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  imageGridContainer: {
    flex: 1,
    marginTop: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
})
