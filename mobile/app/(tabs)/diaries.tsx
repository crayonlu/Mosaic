import { Loading, toast } from '@/components/ui'
import { diariesApi } from '@/lib/api'
import { useThemeStore } from '@/stores/theme-store'
import { type DiaryResponse } from '@/types/api'
import { router } from 'expo-router'
import { FileX } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function DiariesScreen() {
  const { theme } = useThemeStore()
  const [diaries, setDiaries] = useState<DiaryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadDiaries = useCallback(async () => {
    try {
      const response = await diariesApi.list()
      setDiaries(response.items)
    } catch (error) {
      console.error('Load diaries error:', error)
      toast.error('错误', '加载日记失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDiaries()
  }, [loadDiaries])

  const handleRefresh = () => {
    setRefreshing(true)
    loadDiaries()
  }

  const handleDiaryPress = (diary: DiaryResponse) => {
    router.push({ pathname: '/diary/[date]', params: { date: diary.date } })
  }

  const renderItem = ({ item }: { item: DiaryResponse }) => (
    <TouchableOpacity onPress={() => handleDiaryPress(item)}>
      <View style={[styles.diaryItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.date, { color: theme.text }]}>{item.date}</Text>
        <Text style={[styles.preview, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.summary || '无内容'}
        </Text>
        {item.moodKey && <Text style={styles.mood}>{item.moodKey}</Text>}
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Loading text="加载中..." fullScreen />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>日记</Text>
      </View>

      <FlatList
        data={diaries}
        renderItem={renderItem}
        keyExtractor={item => item.date}
        contentContainerStyle={[styles.list, diaries.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        style={{ flex: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
              <FileX size={48} color={theme.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>暂无日记</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              开始记录你的生活点滴
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  diaryItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  date: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
  },
  mood: {
    fontSize: 20,
    marginTop: 8,
  },
  emptyContainer: {
    height: '100%',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
})
