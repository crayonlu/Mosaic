import { getBearerAuthHeaders } from '@/lib/services/api-auth'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@mosaic/api'
import { resourcesApi } from '@mosaic/api'
import { Image } from 'expo-image'
import { Check } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

const { width } = Dimensions.get('window')
const IMAGE_SIZE = (width - 48) / 3

interface CoverImagePickerProps {
  memos: MemoWithResources[]
  selectedCoverId?: string
  onSelect: (resourceId: string) => void
  onClear: () => void
}

export function CoverImagePicker({
  memos,
  selectedCoverId,
  onSelect,
  onClear,
}: CoverImagePickerProps) {
  const { theme } = useThemeStore()
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadAuthHeaders = async () => {
      const headers = await getBearerAuthHeaders()
      setAuthHeaders(headers)
    }
    loadAuthHeaders()
  }, [])

  const allImages = memos.flatMap(memo =>
    memo.resources
      .filter(r => r.resourceType === 'image')
      .map(resource => ({
        resourceId: resource.id,
        memoId: memo.id,
        url: resourcesApi.getDownloadUrl(resource.id),
      }))
  )

  const renderImage = ({ item }: { item: { resourceId: string; memoId: string; url: string } }) => {
    const isSelected = item.resourceId === selectedCoverId
    return (
      <Pressable
        onPress={() => onSelect(item.resourceId)}
        style={[
          styles.imageContainer,
        ]}
      >
        <Image
          source={{ uri: item.url, headers: authHeaders }}
          style={[styles.image, isSelected && styles.imageSelected]}
          contentFit="cover"
        />
        {isSelected && (
          <>
            <View style={[styles.selectedOverlay, { backgroundColor: `${theme.primary}22` }]} />
            <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}> 
              <Check size={12} color="#fff" strokeWidth={3} />
            </View>
          </>
        )}
      </Pressable>
    )
  }

  if (allImages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>暂无图片可选</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>选择封面图片</Text>
        {selectedCoverId && (
          <Pressable onPress={onClear}>
            <Text style={[styles.clearButton, { color: theme.primary }]}>清除选择</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={allImages}
        renderItem={renderImage}
        keyExtractor={item => item.resourceId}
        numColumns={3}
        scrollEnabled={false}
        contentContainerStyle={styles.grid}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    fontSize: 14,
  },
  grid: {
    gap: 8,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    overflow: 'hidden',
    margin: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageSelected: {
    opacity: 0.92,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
})
