import { MarkdownRenderer } from '@/components/editor/MarkdownRenderer'
import { Badge, DraggableImageGrid } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { useAuthHeaders } from '@/hooks/useAuthHeaders'
import { normalizeContent } from '@/lib/utils/content'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/themeStore'
import type { Memo } from '@mosaic/api'
import { resourcesApi } from '@mosaic/api'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { Pencil, Trash2 } from 'lucide-react-native'
import React, { useCallback, useMemo, useState } from 'react'
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const TEXT_MAX_HEIGHT = 160

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

export const MemoCard = React.memo(
  function MemoCard({
    memo,
    onPress,
    onDelete,
    showActions = false,
    showTimestamp = true,
    isSelected = false,
    showPressFeedback = true,
    showSemanticBadge = false,
  }: MemoCardProps) {
    const { theme } = useThemeStore()
    const authHeaders = useAuthHeaders()
    const [isOverflowing, setIsOverflowing] = useState(false)

    // Press scale animation
    const scale = useSharedValue(1)
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }))

    const handlePressIn = useCallback(() => {
      onPress?.()
      if (showPressFeedback) {
        scale.value = withTiming(0.99, { duration: 120, easing: Easing.out(Easing.cubic) })
      }
    }, [showPressFeedback, scale, onPress])

    const handlePressOut = useCallback(() => {
      scale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
    }, [scale])

    const handleTextLayout = useCallback(
      (e: LayoutChangeEvent) => {
        const { height } = e.nativeEvent.layout
        if (!isOverflowing && height > TEXT_MAX_HEIGHT) {
          setIsOverflowing(true)
        }
      },
      [isOverflowing]
    )

    const displayContent = useMemo(() => normalizeContent(memo.content || ''), [memo.content])
    const formattedTime = useMemo(
      () => stringUtils.formatRelativeTime(memo.createdAt),
      [memo.createdAt]
    )
    const mediaItems: MediaGridItem[] = useMemo(
      () =>
        (memo.resources ?? []).map(resource => ({
          key: resource.id,
          uri: resourcesApi.getDownloadUrl(resource.id),
          type: resource.resourceType,
          thumbnailUri:
            resource.resourceType === 'video'
              ? resourcesApi.getThumbnailUrl(resource.id)
              : undefined,
        })),
      [memo.resources]
    )

    const handleDelete = useCallback(() => {
      onDelete?.(memo.id)
    }, [onDelete, memo.id])

    // Card is transparent by default — uses MaskedView with alpha gradient
    // so text fades to truly transparent, never clashing with page-level
    // gradients (e.g., mood-based diary background).
    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
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
              <View style={styles.textContentOuter}>
                {isOverflowing ? (
                  <MaskedView
                    style={{ maxHeight: TEXT_MAX_HEIGHT }}
                    maskElement={
                      <LinearGradient
                        colors={['white', 'transparent']}
                        locations={[0.7, 1]}
                        style={{ flex: 1 }}
                      />
                    }
                  >
                    <View>
                      <MarkdownRenderer content={displayContent} />
                    </View>
                  </MaskedView>
                ) : (
                  <View onLayout={handleTextLayout}>
                    <MarkdownRenderer content={displayContent} />
                  </View>
                )}
              </View>
            )}

            {mediaItems.length > 0 && (
              <View style={styles.imageGridContainer}>
                <DraggableImageGrid
                  items={mediaItems}
                  authHeaders={authHeaders}
                  draggable={false}
                />
              </View>
            )}
          </View>

          {(memo.tags.length > 0 || showActions || showTimestamp) && (
            <View style={styles.metadataContainer}>
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
                    <Text style={[styles.editedBadgeText, { color: theme.textSecondary }]}>
                      已编辑
                    </Text>
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
  },
  (prevProps, nextProps) => {
    return (
      prevProps.memo.id === nextProps.memo.id &&
      prevProps.memo.content === nextProps.memo.content &&
      prevProps.memo.createdAt === nextProps.memo.createdAt &&
      prevProps.memo.revisionCount === nextProps.memo.revisionCount &&
      prevProps.memo.resources === nextProps.memo.resources &&
      prevProps.memo.tags === nextProps.memo.tags &&
      prevProps.onPress === nextProps.onPress &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.showActions === nextProps.showActions &&
      prevProps.showTimestamp === nextProps.showTimestamp &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.showPressFeedback === nextProps.showPressFeedback &&
      prevProps.showSemanticBadge === nextProps.showSemanticBadge
    )
  }
)

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    marginHorizontal: 8,
    marginBottom: 6,
  },
  contentContainer: {
    flexDirection: 'column',
  },
  textContentOuter: {},
  imageGridContainer: {},
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 2,
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
