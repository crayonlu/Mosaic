import { useThemeStore } from '@/stores/theme-store'
import * as ExpoImagePicker from 'expo-image-picker'
import { ImagePlus, X } from 'lucide-react-native'
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native'

interface ImagePickerProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
}

export function ImagePicker({ images, onImagesChange, maxImages = 4 }: ImagePickerProps) {
  const { theme } = useThemeStore()

  const pickImage = async () => {
    if (images.length >= maxImages) return

    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      onImagesChange([...images, result.assets[0].uri])
    }
  }

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {images.map((uri, index) => (
          <View key={index} style={[styles.imageContainer, { backgroundColor: theme.card }]}>
            <Image source={{ uri }} style={styles.image} />
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: theme.background }]}
              onPress={() => removeImage(index)}
            >
              <X size={16} color={theme.text} />
            </TouchableOpacity>
          </View>
        ))}

        {images.length < maxImages && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={pickImage}
          >
            <ImagePlus size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
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
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
