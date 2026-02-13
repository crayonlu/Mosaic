import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import { X } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native'
import { DraggableGrid } from 'react-native-draggable-grid'
import ImageViewing from 'react-native-image-viewing'
import { SafeAreaView } from 'react-native-safe-area-context'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_GAP = 0

const getImageSize = (count: number) => {
  const containerWidth = SCREEN_WIDTH - 26
  if (count === 1) {
    return { width: containerWidth, height: 300 }
  }
  if (count === 2) {
    const size = (containerWidth - GRID_GAP) / 2
    return { width: size, height: 150 }
  }
  const size = (containerWidth - GRID_GAP * 2) / 3
  return { width: size, height: size }
}

interface GridItem {
  key: string
  uri: string
}

interface DraggableImageGridProps {
  images: string[]
  onImagesChange?: (images: string[]) => void
  maxImages?: number
  onAddImage?: () => void
  draggable?: boolean
  onRemove?: (index: number) => void
  onImagePress?: (index: number) => void
}

export function DraggableImageGrid({
  images,
  onImagesChange,
  maxImages = 9,
  onAddImage,
  draggable = true,
  onRemove,
  onImagePress,
}: DraggableImageGridProps) {
  const { theme } = useThemeStore()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  
  const gridData: GridItem[] = images.map((uri, index) => ({
    key: `img_${index}_${uri}`,
    uri,
  }))

  const imageSize = getImageSize(images.length)
  const imageImages = images.map(uri => ({ uri }))

  const handleDragRelease = useCallback((data: GridItem[]) => {
    if (!onImagesChange) return
    const newImages = data.map(item => item.uri)
    onImagesChange(newImages)
  }, [onImagesChange])

  const handleRemove = useCallback((index: number) => {
    if (onImagesChange) {
      onImagesChange(images.filter((_, i) => i !== index))
    } else if (onRemove) {
      onRemove(index)
    }
  }, [images, onImagesChange, onRemove])

  const handleImagePress = useCallback((index: number) => {
    if (onImagePress) {
      onImagePress(index)
    } else {
      setPreviewIndex(index)
    }
  }, [onImagePress])

  const renderItem = useCallback((item: GridItem, order: number) => {
    const index = order
    return (
      <View style={[styles.imageWrapper, { width: imageSize.width, height: imageSize.height }]}>
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={() => handleImagePress(index)}
          activeOpacity={0.9}
        >
          <Image source={{ uri: item.uri }} style={styles.image} contentFit="cover" />
        </TouchableOpacity>
        {(onRemove || onImagesChange) && (
          <TouchableOpacity
            style={[styles.removeButton, { backgroundColor: theme.background }]}
            onPress={() => handleRemove(index)}
          >
            <X size={14} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>
    )
  }, [imageSize, theme, handleImagePress, handleRemove, onRemove, onImagesChange])

  if (!draggable) {
    return (
      <View style={styles.container}>
        <View style={styles.grid}>
          {images.map((uri, index) => (
            <View key={index} style={[styles.imageWrapper, { width: imageSize.width, height: imageSize.height }]}>
              <TouchableOpacity
                style={styles.imageContainer}
                onPress={() => handleImagePress(index)}
                activeOpacity={0.9}
              >
                <Image source={{ uri }} style={styles.image} contentFit="cover" />
              </TouchableOpacity>
              {onRemove && (
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.background }]}
                  onPress={() => handleRemove(index)}
                >
                  <X size={14} color={theme.text} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

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

  return (
    <View style={styles.container}>
      <DraggableGrid
        numColumns={images.length <= 2 ? images.length : 3}
        data={gridData}
        renderItem={renderItem}
        onDragRelease={handleDragRelease}
        style={styles.grid}
      />

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
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageWrapper: {
    margin: GRID_GAP / 2,
    position: 'relative',
    overflow: 'hidden',
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
    top: 50,
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
