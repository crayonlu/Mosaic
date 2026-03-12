import { useThemeStore } from '@/stores/theme-store'
import { Image as ImageIcon, Play } from 'lucide-react-native'
import { StyleSheet, Text, View } from 'react-native'

export interface UploadProgressItem {
  id: string
  name: string
  type: 'image' | 'video'
  progress: number
}

interface UploadProgressListProps {
  items: UploadProgressItem[]
}

export function UploadProgressList({ items }: UploadProgressListProps) {
  const { theme } = useThemeStore()

  if (items.length === 0) {
    return null
  }

  return (
    <View style={styles.container}>
      {items.map(item => (
        <View
          key={item.id}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.background }]}>
            {item.type === 'video' ? (
              <Play size={14} color={theme.textSecondary} fill={theme.textSecondary} />
            ) : (
              <ImageIcon size={14} color={theme.textSecondary} />
            )}
          </View>
          <View style={styles.content}>
            <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
              {item.name}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: theme.primary,
                    width: `${Math.max(4, item.progress)}%`,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.percent, { color: theme.textSecondary }]}>{item.progress}%</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  percent: {
    fontSize: 12,
    width: 36,
    textAlign: 'right',
  },
})
