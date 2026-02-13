import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import { X } from 'lucide-react-native'
import { useState } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_GAP = 8
const IMAGE_SIZE = (SCREEN_WIDTH - 32 - GRID_GAP * 2) / 3

interface DraggableImageGridProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
  onAddImage?: () => void
}

export function DraggableImageGrid({
  images,
  onImagesChange,
  maxImages = 9,
  onAddImage,
}: DraggableImageGridProps) {
  const { theme } = useThemeStore()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images]
    const [movedItem] = newImages.splice(fromIndex, 1)
    newImages.splice(toIndex, 0, movedItem)
    onImagesChange(newImages)
  }

  const renderImages = () => {
    const rows: React.ReactNode[] = []
    for (let i = 0; i < images.length; i += 3) {
      const rowImages = images.slice(i, i + 3)
      rows.push(
        <View key={i} style={styles.row}>
          {rowImages.map((uri, index) => {
            const actualIndex = i + index
            return (
              <View key={actualIndex} style={styles.imageWrapper}>
                <TouchableOpacity
                  style={styles.imageContainer}
                  onPress={() => setPreviewIndex(actualIndex)}
                  onLongPress={() => {
                    const nextIndex = (actualIndex + 1) % images.length
                    moveImage(actualIndex, nextIndex)
                  }}
                >
                  <Image source={{ uri }} style={styles.image} contentFit="cover" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.background }]}
                  onPress={() => removeImage(actualIndex)}
                >
                  <X size={14} color={theme.text} />
                </TouchableOpacity>
              </View>
            )
          })}
          {rowImages.length < 3 && Array.from({ length: 3 - rowImages.length }).map((_, idx) => (
            <View key={`empty-${idx}`} style={styles.imageWrapper} />
          ))}
        </View>
      )
    }
    return rows
  }

  return (
    <View style={styles.container}>
      {renderImages()}

      {images.length < maxImages && (
        <TouchableOpacity
          style={[styles.addButton, { borderColor: theme.border }]}
          onPress={onAddImage}
        >
          <Text style={[styles.addButtonText, { color: theme.textSecondary }]}>+</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={previewIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalOverlay} onPress={() => setPreviewIndex(null)}>
            {previewIndex !== null && (
              <Image
                source={{ uri: images[previewIndex] }}
                style={styles.previewImage}
                contentFit="contain"
              />
            )}
          </Pressable>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.background }]}
            onPress={() => setPreviewIndex(null)}
          >
            <X size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  imageWrapper: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    margin: GRID_GAP / 2,
    position: 'relative',
  },
  imageContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    margin: GRID_GAP / 2,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 32,
    fontWeight: '300',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
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
  },
})
