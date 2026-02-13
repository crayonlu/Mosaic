import { Badge } from '@/components/ui'
import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import { X } from 'lucide-react-native'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MarkdownRenderer } from './MarkdownRenderer'

interface PostPreviewProps {
  visible: boolean
  content: string
  images: string[]
  tags: string[]
  onClose: () => void
  onPost: () => void
}

export function PostPreview({
  visible,
  content,
  images,
  tags,
  onClose,
  onPost,
}: PostPreviewProps) {
  const { theme } = useThemeStore()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <X size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Preview</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.content}>
          {content.trim() ? (
            <MarkdownRenderer content={content} />
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No content
            </Text>
          )}

          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.slice(0, 9).map((uri, index) => (
                <Image
                  key={index}
                  source={{ uri }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
              ))}
            </View>
          )}

          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag) => (
                <Badge key={tag} text={tag} variant="outline" size="small" />
              ))}
            </View>
          )}
        </View>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.footerButton, { borderColor: theme.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerButton, styles.postButton, { backgroundColor: theme.primary }]}
            onPress={onPost}
          >
            <Text style={[styles.postText, { color: '#fff' }]}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  postButton: {
    borderWidth: 0,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  postText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
