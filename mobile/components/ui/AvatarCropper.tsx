import { useThemeStore } from '@/stores/theme-store'
import { Image } from 'expo-image'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { RotateCw, X } from 'lucide-react-native'
import { useState } from 'react'
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Button } from './Button'

const { width: screenWidth } = Dimensions.get('window')
const CROPPER_SIZE = screenWidth * 0.85

interface AvatarCropperProps {
  visible: boolean
  imageUri: string
  onClose: () => void
  onCropComplete: (croppedUri: string) => void
}

export function AvatarCropper({ visible, imageUri, onClose, onCropComplete }: AvatarCropperProps) {
  const { theme } = useThemeStore()
  const [rotation, setRotation] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleCrop = async () => {
    setIsProcessing(true)
    try {
      const manipulators: ImageManipulator.Action[] = []

      // Apply rotation if needed
      if (rotation !== 0) {
        manipulators.push({
          rotate: rotation,
        })
      }

      // Target size for avatar (square)
      const targetSize = 500

      // Resize to cover a square area (simulating center crop)
      // We'll resize to a slightly larger size to ensure quality
      manipulators.push({
        resize: {
          width: targetSize,
          height: targetSize,
        },
      })

      const result = await ImageManipulator.manipulateAsync(imageUri, manipulators, {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      })

      onCropComplete(result.uri)
    } catch (error) {
      console.error('Crop error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    setRotation(0)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>裁剪头像</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          <View
            style={[
              styles.cropperContainer,
              {
                width: CROPPER_SIZE,
                height: CROPPER_SIZE,
                borderColor: theme.primary,
              },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.image,
                {
                  transform: [{ rotate: `${rotation}deg` }],
                },
              ]}
              contentFit="cover"
            />
          </View>

          <Text style={[styles.hint, { color: theme.textSecondary }]}>头像将裁剪为 1:1 正方形</Text>

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.rotateButton, { backgroundColor: theme.surface }]}
              onPress={handleRotate}
            >
              <RotateCw size={24} color={theme.text} />
              <Text style={[styles.rotateText, { color: theme.text }]}>旋转</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.footer, { backgroundColor: theme.surface }]}>
          <Button
            title="取消"
            variant="secondary"
            onPress={handleClose}
            style={styles.footerButton}
          />
          <Button
            title="完成"
            variant="primary"
            onPress={handleCrop}
            loading={isProcessing}
            style={styles.footerButton}
          />
        </View>
      </View>
    </Modal>
  )
}

// Helper function to pick and crop avatar image
export async function pickAndCropAvatar(): Promise<string | null> {
  // Request permissions
  const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync()
  const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync()

  if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
    console.log('Permissions not granted')
    return null
  }

  // Launch image library with editing enabled
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1], // Force 1:1 aspect ratio
    quality: 0.9,
  })

  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri
  }

  return null
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cropperContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  hint: {
    marginTop: 16,
    fontSize: 14,
  },
  controls: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 16,
  },
  rotateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  rotateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
})
