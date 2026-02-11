import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import { Maximize2, X } from 'lucide-react-native'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type ImageSource = string | { uri: string; headers?: Record<string, string> }

interface ImageGridProps {
  images: ImageSource[]
  onRemove?: (index: number) => void
  showRemoveButton?: boolean
  maxImages?: number
  mode?: 'edit' | 'view' | 'card'
  onImagePress?: (index: number) => void
}

export function ImageGrid({
  images,
  onRemove,
  showRemoveButton = true,
  maxImages = 9,
  mode = 'view',
  onImagePress,
}: ImageGridProps) {
  const { theme } = useThemeStore()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const normalizeSource = (img: ImageSource): { uri: string; headers?: Record<string, string> } => {
    if (typeof img === 'string') return { uri: img }
    if (img.headers && img.headers.Authorization) {
      return {
        uri: img.uri,
        headers: {
          Authorization: img.headers.Authorization,
        },
      }
    }
    return img
  }

  const getGridLayout = (count: number) => {
    if (count === 0) return { columns: 0, size: 0 }
    if (count === 1) {
      return { columns: 1, size: mode === 'card' ? 100 : 200 }
    }
    if (count <= 3) {
      const gap = 8
      const padding = mode === 'card' ? 0 : 16
      const availableWidth = Math.min(375, 700) - padding * 2 - gap
      const size = availableWidth / 2
      return { columns: 2, size }
    }
    const gap = 8
    const padding = mode === 'card' ? 0 : 16
    const availableWidth = Math.min(375, 700) - padding * 2 - gap * 2
    const size = availableWidth / 3
    return { columns: 3, size }
  }

  if (mode === 'edit') {
    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.editContainer}
          contentContainerStyle={styles.editGrid}
        >
          {images.map((img, index) => (
            <View
              key={index}
              style={[
                styles.editImageContainer,
                {
                  backgroundColor: theme.card,
                },
              ]}
            >
              <Pressable
                style={styles.editImageWrapper}
                onPress={() => onImagePress && onImagePress(index)}
              >
                <Image
                  source={normalizeSource(img)}
                  style={styles.editImage}
                  contentFit="cover"
                />
              </Pressable>
              {showRemoveButton && onRemove && (
                <TouchableOpacity
                  style={[styles.editRemoveButton, { backgroundColor: theme.background }]}
                  onPress={() => onRemove(index)}
                >
                  <X size={14} color={theme.text} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {images.length < maxImages && (
            <View
              style={[
                styles.editAddButton,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <Maximize2 size={20} color={theme.textSecondary} />
            </View>
          )}
        </ScrollView>
        {images.length > 0 && (
          <Text style={[styles.editCount, { color: theme.textSecondary }]}>
            {images.length}/{maxImages}
          </Text>
        )}
      </>
    )
  }

  const layout = getGridLayout(images.length)
  const isWaterfall = images.length > 9

  const showDeleteInCard = mode === 'card' ? false : showRemoveButton

  return (
    <>
      <View
        style={[
          styles.viewGrid,
          {
            gap: 8,
            flexDirection: isWaterfall ? 'column' : 'row',
            flexWrap: isWaterfall ? 'nowrap' : 'wrap',
          },
        ]}
      >
        {images.map((img, index) => (
          <Pressable
            key={index}
            style={[
              styles.viewImageContainer,
              {
                backgroundColor: theme.card,
                width: layout.size,
                height: layout.size,
              },
            ]}
            onPress={() => onImagePress && onImagePress(index)}
          >
            <Image
              source={normalizeSource(img)}
              style={styles.viewImage}
              contentFit="cover"
            />
            {showDeleteInCard && onRemove && (
              <TouchableOpacity
                style={[styles.viewRemoveButton, { backgroundColor: theme.background }]}
                onPress={(e) => {
                  e.stopPropagation()
                  onRemove(index)
                }}
              >
                <X size={14} color={theme.text} />
              </TouchableOpacity>
            )}
          </Pressable>
        ))}
      </View>

      {/* 全屏预览弹窗 */}
      <Modal
        visible={previewIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
      >
        {previewIndex !== null && (
          <View style={styles.modalContainer}>
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setPreviewIndex(null)}
            >
              <Image
                source={normalizeSource(images[previewIndex])}
                style={styles.previewImage}
                contentFit="contain"
              />
            </Pressable>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.background }]}
              onPress={() => setPreviewIndex(null)}
            >
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  editContainer: {
    maxHeight: 100,
  },
  editGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  editImageWrapper: {
    width: '100%',
    height: '100%',
  },
  editImage: {
    width: '100%',
    height: '100%',
  },
  editRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  editAddButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCount: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  viewGrid: {
  },
  viewImageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  viewImage: {
    width: '100%',
    height: '100%',
  },
  viewRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
})
