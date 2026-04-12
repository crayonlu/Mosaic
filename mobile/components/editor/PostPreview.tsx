import { Badge, DraggableImageGrid } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { useCacheStore } from '@/stores/cacheStore'
import { useThemeStore } from '@/stores/themeStore'
import { X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MarkdownRenderer } from './MarkdownRenderer'

interface PostPreviewProps {
  visible: boolean
  content: string
  items: MediaGridItem[]
  tags: string[]
  onClose: () => void
  onPost: () => void
}

export function PostPreview({ visible, content, items, tags, onClose, onPost }: PostPreviewProps) {
  const { theme } = useThemeStore()
  const { isReady: isCacheReady } = useCacheStore()
  const insets = useSafeAreaInsets()
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
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
          },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <X size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>预览</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {content.trim() ? (
            <View style={styles.textContent}>
              <MarkdownRenderer content={content} />
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>无内容</Text>
          )}

          {items.length > 0 && (
            <View style={styles.imageGridContainer}>
              <DraggableImageGrid
                items={items}
                authHeaders={authHeaders}
                draggable={false}
                isCacheLoading={!isCacheReady}
              />
            </View>
          )}

          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map(tag => (
                <Badge key={tag} text={`#${tag}`} variant="outline" size="small" />
              ))}
            </View>
          )}
        </ScrollView>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  textContent: {
    flexShrink: 1,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  imageGridContainer: {
    marginTop: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
})
