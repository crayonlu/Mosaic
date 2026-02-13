import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import { X } from 'lucide-react-native'
import { useState } from 'react'
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import ImageViewing from 'react-native-image-viewing'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_GAP = 8

const getImageSize = (count: number) => {
  const containerWidth = SCREEN_WIDTH - 32
  if (count === 1) {
    return { width: containerWidth, height: 300, columns: 1 }
  }
  if (count === 2) {
    const size = (containerWidth - GRID_GAP) / 2
    return { width: size, height: 150, columns: 2 }
  }
  const size = (containerWidth - GRID_GAP * 2) / 3
  return { width: size, height: size, columns: 3 }
}

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

  const imageSize = getImageSize(images.length)
  const imageImages = images.map(uri => ({ uri }))

  const renderImages = () => {
    const rows: React.ReactNode[] = []
    for (let i = 0; i < images.length; i += imageSize.columns) {
      const rowImages = images.slice(i, i + imageSize.columns)
      rows.push(
        <View key={i} style={styles.row}>
          {rowImages.map((uri, index) => {
            const actualIndex = i + index
            return (
              <View key={actualIndex} style={[styles.imageWrapper, { width: imageSize.width, height: imageSize.height }]}>
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
          {rowImages.length < imageSize.columns && Array.from({ length: imageSize.columns - rowImages.length }).map((_, idx) => (
            <View key={`empty-${idx}`} style={[styles.imageWrapper, { width: imageSize.width, height: imageSize.height }]} />
          ))}
        </View>
      )
    }
    return rows
  }

  return (
    <View style={styles.container}>
      {renderImages()}

      {previewIndex !== null && (
        <SafeAreaView style={StyleSheet.absoluteFill} edges={['top', 'bottom']}>
          <ImageViewing
            images={imageImages}
            imageIndex={previewIndex}
            visible={true}
            onRequestClose={() => setPreviewIndex(null)}
            presentationStyle="fullScreen"
          />
          <View style={styles.closeButtonContainer}>
            <TouchableOpacity
              style={[styles.previewCloseButton, { backgroundColor: theme.background }]}
              onPress={() => setPreviewIndex(null)}
            >
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  imageWrapper: {
    margin: GRID_GAP / 2,
    position: 'relative',
  },
  imageContainer: {
    flex: 1,
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
  closeButtonContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
  },
  previewCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
