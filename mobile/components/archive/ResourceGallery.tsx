import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { useState } from 'react'
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ResizeMode, Video } from 'react-native-video'

interface ResourceGalleryProps {
  memo: MemoWithResources
  onImagePress?: (index: number) => void
}

interface ImagePreviewProps {
  visible: boolean
  images: string[]
  initialIndex: number
  onClose: () => void
}

export function ResourceGallery({ memo, onImagePress }: ResourceGalleryProps) {
  const { theme } = useThemeStore()
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  // Separate resources by type
  const images = memo.resources.filter(r => r.resourceType === 'image')
  const videos = memo.resources.filter(r => r.resourceType === 'video')

  // Handle image press
  const handleImagePress = (index: number) => {
    setPreviewIndex(index)
    setPreviewVisible(true)
    onImagePress?.(index)
  }

  // Get image grid layout
  const getImageLayout = () => {
    const count = images.length
    if (count === 0) return null
    if (count === 1) return 'single'
    if (count <= 4) return 'two-columns'
    return 'three-columns'
  }

  const layout = getImageLayout()

  return (
    <View style={styles.container}>
      {/* Images */}
      {images.length > 0 && layout && (
        <View style={styles.section}>
          {layout === 'single' && (
            <TouchableOpacity onPress={() => handleImagePress(0)} activeOpacity={0.8}>
              <Image
                source={{ uri: `file://${images[0].filename}` }}
                style={styles.singleImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {layout === 'two-columns' && (
            <View style={styles.twoColumnGrid}>
              {images.map((img, index) => (
                <TouchableOpacity
                  key={img.id}
                  onPress={() => handleImagePress(index)}
                  activeOpacity={0.8}
                  style={styles.gridItem}
                >
                  <Image
                    source={{ uri: `file://${img.filename}` }}
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {layout === 'three-columns' && (
            <View style={styles.threeColumnGrid}>
              {images.slice(0, 9).map((img, index) => (
                <TouchableOpacity
                  key={img.id}
                  onPress={() => handleImagePress(index)}
                  activeOpacity={0.8}
                  style={styles.gridItem}
                >
                  <Image
                    source={{ uri: `file://${img.filename}` }}
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
              {images.length > 9 && (
                <View style={[styles.gridItem, styles.moreIndicator]}>
                  <Text style={[styles.moreText, { color: theme.text }]}>+{images.length - 9}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <View style={styles.section}>
          {videos.map(video => (
            <View key={video.id} style={styles.videoContainer}>
              <Video
                source={{ uri: `file://${video.filename}` }}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                controls={true}
                paused={true}
              />
            </View>
          ))}
        </View>
      )}

      {/* Image Preview Modal */}
      <ImagePreview
        visible={previewVisible}
        images={images.map(img => `file://${img.filename}`)}
        initialIndex={previewIndex}
        onClose={() => setPreviewVisible(false)}
      />
    </View>
  )
}

function ImagePreview({ visible, images, initialIndex, onClose }: ImagePreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const screenWidth = Dimensions.get('window').width

  if (visible) {
    setCurrentIndex(initialIndex)
  }

  const handlePrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
  }

  if (!visible || images.length === 0) {
    return null
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.previewContainer}>
        <TouchableOpacity style={styles.previewBackground} activeOpacity={1} onPress={onClose}>
          {/* Previous button */}
          {images.length > 1 && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePrevious}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={styles.navButtonText}>◀</Text>
            </TouchableOpacity>
          )}

          {/* Image */}
          <ScrollView
            maximumZoomScale={3}
            minimumZoomScale={1}
            contentContainerStyle={styles.previewContent}
          >
            <Image
              source={{ uri: images[currentIndex] }}
              style={[styles.previewImage, { width: screenWidth - 40 }]}
              resizeMode="contain"
            />
          </ScrollView>

          {/* Next button */}
          {images.length > 1 && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNext}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={styles.navButtonText}>▶</Text>
            </TouchableOpacity>
          )}

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Page indicator */}
          {images.length > 1 && (
            <View style={styles.pageIndicator}>
              <Text style={[styles.pageIndicatorText, { color: '#FFFFFF' }]}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  section: {
    marginBottom: 12,
  },
  singleImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  twoColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  threeColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  moreIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    marginBottom: 8,
  },
  video: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  previewBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    alignItems: 'center',
  },
  previewImage: {
    borderRadius: 8,
  },
  navButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pageIndicatorText: {
    fontSize: 14,
    fontWeight: '500',
  },
})
