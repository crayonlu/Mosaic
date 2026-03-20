import { MarkdownRenderer } from '@/components/editor/MarkdownRenderer'
import { Badge, DraggableImageGrid } from '@/components/ui'
import type { MediaGridItem } from '@/components/ui/DraggableImageGrid'
import { getBearerAuthHeaders } from '@/lib/services/apiAuth'
import { normalizeContent } from '@/lib/utils/content'
import { stringUtils } from '@/lib/utils/string'
import { useCacheStore } from '@/stores/cacheStore'
import { useThemeStore } from '@/stores/themeStore'
import type { MemoWithResources } from '@mosaic/api'
import { apiClient, resourcesApi } from '@mosaic/api'
import { Trash2 } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

function toAbsoluteUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  const baseUrl = apiClient.getBaseUrl()
  return baseUrl ? `${baseUrl}${url}` : url
}

interface MemoCardProps {
  memo: MemoWithResources
  onPress?: () => void
  onDelete?: (id: string) => void
  showActions?: boolean
  showTimestamp?: boolean
  isSelected?: boolean
  showPressFeedback?: boolean
}

export function MemoCard({
  memo,
  onPress,
  onDelete,
  showActions = true,
  showTimestamp = true,
  isSelected = false,
  showPressFeedback = true,
}: MemoCardProps) {
  const { theme } = useThemeStore()
  const { isReady: isCacheReady } = useCacheStore()
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await getBearerAuthHeaders()
      setAuthHeaders(headers)
    }
    loadAuthHeaders()
  }, [])

  const displayContent = normalizeContent(memo.content || '')
  const formattedTime = stringUtils.formatRelativeTime(memo.createdAt)
  const mediaItems: MediaGridItem[] = memo.resources.map(resource => ({
    key: resource.id,
    uri: resourcesApi.getDownloadUrl(resource.id),
    type: resource.resourceType,
    thumbnailUri:
      resource.resourceType === 'video' ? toAbsoluteUrl(resource.thumbnailUrl) : undefined,
  }))

  const handleDelete = () => {
    onDelete?.(memo.id)
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isSelected
            ? theme.surface
            : pressed && showPressFeedback
              ? `${theme.surface}80`
              : 'transparent',
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.contentContainer}>
        {displayContent && (
          <View style={styles.textContent}>
            <MarkdownRenderer content={displayContent} />
          </View>
        )}

        {mediaItems.length > 0 && (
          <View style={styles.imageGridContainer}>
            <DraggableImageGrid
              items={mediaItems}
              authHeaders={authHeaders}
              draggable={false}
              isCacheLoading={!isCacheReady}
            />
          </View>
        )}
      </View>

      {(memo.tags.length > 0 || showActions || showTimestamp) && (
        <View style={[styles.metadataContainer, { borderColor: theme.border }]}>
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
  )
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 12,
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
    paddingVertical: 8,
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
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 6,
  },
})
