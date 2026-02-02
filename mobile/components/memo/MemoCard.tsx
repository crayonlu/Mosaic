import { Badge } from '@/components/ui'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { Trash2 } from 'lucide-react-native'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

interface MemoCardProps {
  memo: MemoWithResources
  onPress: () => void
  onDelete?: (id: string) => void
  showActions?: boolean
}

export function MemoCard({
  memo,
  onPress,
  onDelete,
  showActions = true,
}: MemoCardProps) {
  const { theme } = useThemeStore()

  // Extract plain text from HTML for preview
  const plainText = stringUtils.extractTextFromHtml(memo.content)

  // Format timestamp
  const formattedTime = stringUtils.formatRelativeTime(memo.createdAt)

  // Check if memo has resources
  const hasResources = memo.resources.length > 0
  const hasImages = memo.resources.some(r => r.resourceType === 'image')
  const hasOtherResources = memo.resources.some(r => r.resourceType !== 'image')

  // Get image preview
  const imageResource = memo.resources.find(r => r.resourceType === 'image')

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
        {imageResource && (
          <Image
            source={{ uri: imageResource.url }}
            style={styles.imagePreview}
            resizeMode="cover"
          />
        )}

        {/* Text content */}
        <View style={[styles.textContent, !imageResource && styles.textContentFull]}>
          <Text style={[styles.text, { color: theme.text }]} numberOfLines={4} ellipsizeMode="tail">
            {plainText || '无文字内容'}
          </Text>
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
              {hasImages && imageResource && (
                <Text style={[styles.resourceText, { color: theme.textSecondary }]}>
                  🖼️ {memo.resources.filter(r => r.resourceType === 'image').length}
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
