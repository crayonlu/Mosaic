import { Badge } from '@/components/ui'
import { ImageGrid } from '@/components/ui/ImageGrid'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { Trash2 } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

interface MemoCardProps {
  memo: MemoWithResources
  onPress: () => void
  onDelete?: (id: string) => void
  showActions?: boolean
}

export function MemoCard({ memo, onPress, onDelete, showActions = true }: MemoCardProps) {
  const { theme } = useThemeStore()

  // Extract plain text from HTML for preview
  const plainText = stringUtils.extractTextFromHtml(memo.content)

  // Format timestamp
  const formattedTime = stringUtils.formatRelativeTime(memo.createdAt)

  // Check if memo has resources
  const hasResources = memo.resources.length > 0
  const hasImages = memo.resources.some(r => r.resourceType === 'image')
  const hasOtherResources = memo.resources.some(r => r.resourceType !== 'image')

  // Get all image resources
  const imageResources = memo.resources.filter(r => r.resourceType === 'image')
  const imageUrls = imageResources.map(r => r.url)

  const handleDelete = () => {
    onDelete?.(memo.id)
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.contentContainer}>
        {imageUrls.length > 0 && (
          <View style={styles.imageGridContainer}>
            <ImageGrid
              images={imageUrls}
              mode="card"
              onImagePress={() => {}}
            />
          </View>
        )}

        {/* Text content */}
        <View style={[styles.textContent, imageUrls.length === 0 && styles.textContentFull]}>
          {plainText ? (
            plainText.split('\n').slice(0, 4).map((line, index) => (
              <Text key={index} style={[styles.text, { color: theme.text }]} numberOfLines={3} ellipsizeMode="tail">
                {line || ' '}
              </Text>
            ))
          ) : (
            <Text style={[styles.text, { color: theme.text }]}>无文字内容</Text>
          )}
        </View>
      </View>

      {/* Tags and metadata */}
      {(memo.tags.length > 0 || hasResources || showActions) && (
        <View style={[styles.metadataContainer, { borderTopColor: theme.border }]}>
          {/* Tags */}
          {memo.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {memo.tags.slice(0, 3).map(tag => (
                <Badge key={tag} text={tag} variant="outline" size="small" />
              ))}
              {memo.tags.length > 3 && (
                <Text style={[styles.moreTags, { color: theme.textSecondary }]}>
                  +{memo.tags.length - 3}
                </Text>
              )}
            </View>
          )}

          {/* Resource indicators */}
          {hasResources && (
            <View style={styles.resourceIndicators}>
              {hasImages && imageUrls.length > 0 && (
                <Text style={[styles.resourceText, { color: theme.textSecondary }]}>
                  🖼️ {imageUrls.length}
                </Text>
              )}
              {hasOtherResources && (
                <Text style={[styles.resourceText, { color: theme.textSecondary }]}>
                  📎 {memo.resources.filter(r => r.resourceType !== 'image').length}
                </Text>
              )}
            </View>
          )}

          {/* Timestamp */}
          <Text style={[styles.timestamp, { color: theme.textSecondary }]}>{formattedTime}</Text>
          {/* Actions */}
          {showActions && (
            <View style={styles.actionsContainer}>
              {onDelete && (
                <Pressable
                  onPress={handleDelete}
                  style={styles.actionButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 size={16} color={theme.textSecondary} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  contentContainer: {
    flexDirection: 'row',
    minHeight: 80,
  },
  imageGridContainer: {
    width: 100,
    height: 100,
    marginRight: 12,
  },
  imagePreview: {
    width: 100,
    height: 100,
  },
  textContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  textContentFull: {
    width: '100%',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  moreTags: {
    fontSize: 12,
    marginLeft: 4,
  },
  resourceIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resourceText: {
    fontSize: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 6,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.7,
  },
})
