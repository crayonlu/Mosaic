import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import * as ExpoImagePicker from 'expo-image-picker'
import { ImagePlus, Upload, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Button } from './Button'

interface ImagePickerProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
  showUploadButton?: boolean
  triggerUpload?: number
}

export function ImagePicker({
  images,
  onImagesChange,
  maxImages = 9,
  showUploadButton = true,
  triggerUpload = 0,
}: ImagePickerProps) {
  const { theme } = useThemeStore()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const pickImage = async () => {
    if (images.length >= maxImages) return

    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri)
      const remainingSlots = maxImages - images.length
      const imagesToAdd = newImages.slice(0, remainingSlots)
      onImagesChange([...images, ...imagesToAdd])
    }
  }

  useEffect(() => {
    if (triggerUpload > 0) {
      pickImage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerUpload])

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  return (
    <View style={styles.container}>
      {showUploadButton && images.length === 0 && (
        <View style={styles.uploadButtonContainer}>
          <Button
            title="上传"
            onPress={pickImage}
            variant="secondary"
            size="large"
            leftIcon={<Upload size={20} color="#fff" />}
          />
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.editContainer, images.length > 0 && { marginTop: 16 }]}
        contentContainerStyle={styles.editGrid}
      >
        {images.map((uri, index) => (
          <View
            key={index}
            style={[
              styles.editImageContainer,
              {
                backgroundColor: theme.surface,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.editImageWrapper}
              onPress={() => setPreviewIndex(index)}
              onLongPress={() => {
                // Future: implement drag-and-drop reordering
              }}
            >
              <Image source={{ uri }} style={styles.editImage} contentFit="cover" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editRemoveButton, { backgroundColor: theme.background }]}
              onPress={() => removeImage(index)}
            >
              <X size={14} color={theme.text} />
            </TouchableOpacity>
          </View>
        ))}

        {images.length < maxImages && images.length > 0 && (
          <TouchableOpacity
            style={[
              styles.editAddButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
            onPress={pickImage}
          >
            <ImagePlus size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </ScrollView>
      {images.length > 0 && (
        <Text style={[styles.editCount, { color: theme.textSecondary }]}>
          {images.length}/{maxImages}
        </Text>
      )}

      {/* Full-screen image preview modal */}
      <Modal
        visible={previewIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setPreviewIndex(null)}
          >
            {previewIndex !== null && (
              <Image
                source={{ uri: images[previewIndex] }}
                style={styles.previewImage}
                contentFit="contain"
              />
            )}
          </TouchableOpacity>
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
  container: {},
  uploadButtonContainer: {},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
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
  editContainer: {},
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
    borderRadius: 8,
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
})
