import { MarkdownRenderer } from '@/components/editor/MarkdownRenderer'
import { Badge, DraggableImageGrid } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { normalizeContent } from '@/lib/utils/content'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/themeStore'
import type { Memo } from '@mosaic/api'
import { resourcesApi } from '@mosaic/api'
import { Pencil, Trash2 } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

interface MemoCardProps {
  memo: Memo
  onPress?: () => void
  onDelete?: (id: string) => void
  showActions?: boolean
  showTimestamp?: boolean
  isSelected?: boolean
  showPressFeedback?: boolean
  showSemanticBadge?: boolean
}

export function MemoCard({
  memo,
  onPress,
  onDelete,
  showActions = true,
  showTimestamp = true,
  isSelected = false,
  showPressFeedback = true,
  showSemanticBadge = false,
}: MemoCardProps) {
  const { theme } = useThemeStore()
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) })
  }

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) })
  }

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await getBearerAuthHeaders()
      setAuthHeaders(headers)
    }
    loadAuthHeaders()
  }, [])

  const displayContent = normalizeContent(memo.content || '')
  const formattedTime = stringUtils.formatRelativeTime(memo.createdAt)
  const mediaItems: MediaGridItem[] = (memo.resources ?? []).map(resource => ({
    key: resource.id,
    uri: resourcesApi.getDownloadUrl(resource.id),
    type: resource.resourceType,
    thumbnailUri:
      resource.resourceType === 'video' ? resourcesApi.getThumbnailUrl(resource.id) : undefined,
  }))

  const handleDelete = () => {
    onDelete?.(memo.id)
  }

  return (
    <Animated.View style={onPress ? animatedStyle : undefined}>
    <Pressable
      onPress={onPress}
      onPressIn={onPress ? handlePressIn : undefined}
      onPressOut={onPress ? handlePressOut : undefined}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isSelected
            ? theme.surface
            : pressed && showPressFeedback
              ? theme.surfaceMuted
              : 'transparent',
          borderRadius: theme.radius.medium,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: pressed && showPressFeedback ? 'transparent' : theme.border,
          ...(pressed && showPressFeedback
            ? { shadowOpacity: 0, elevation: 0 }
            : theme.shadows.subtle),
        },
      ]}
    >
      {showSemanticBadge && (
        <View
          style={[
            styles.semanticBadge,
            { backgroundColor: theme.semantic.infoSoft, borderColor: theme.info },
          ]}
        >
          <Text style={[styles.semanticBadgeText, { color: theme.info }]}>语义</Text>
        </View>
      )}
      <View style={styles.contentContainer}>
        {displayContent && (
          <View style={styles.textContent}>
            <MarkdownRenderer content={displayContent} />
          </View>
        )}

        {mediaItems.length > 0 && (
          <View style={styles.imageGridContainer}>
            <DraggableImageGrid items={mediaItems} authHeaders={authHeaders} draggable={false} />
          </View>
        )}
      </View>

      {(memo.tags.length > 0 || showActions || showTimestamp) && (
        <View style={[styles.metadataContainer, { borderTopColor: theme.border }]}>
          {memo.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {memo.tags.slice(0, 3).map(tag => (
                <Badge key={tag} text={`#${tag}`} variant="outline" size="small" />
              ))}
              {memo.tags.length > 3 && (
                <Text style={[styles.moreTags, { color: theme.textSecondary }]}>
                  +{memo.tags.length - 3}
                </Text>
              )}
            </View>
          )}

          <View style={[styles.rightSection, memo.tags.length === 0 ? { width: '100%' } : {}]}>
            {showTimestamp && (
              <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
                {formattedTime}
              </Text>
            )}
            {(memo.revisionCount ?? 0) > 1 && (
              <View style={[styles.editedBadge, { backgroundColor: theme.surfaceMuted }]}>
                <Pencil size={10} color={theme.textSecondary} strokeWidth={2} />
                <Text style={[styles.editedBadgeText, { color: theme.textSecondary }]}>已编辑</Text>
              </View>
            )}
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
        </View>
      )}
    </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  contentContainer: {
    flexDirection: 'column',
  },
  textContent: {
    flex: 1,
  },
  imageGridContainer: {},
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 2,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    fontWeight: '400',
    marginLeft: 4,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.7,
  },
  editedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  editedBadgeText: {
    fontSize: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  semanticBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 1,
  },
  semanticBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionButton: {
    padding: 6,
  },
})
