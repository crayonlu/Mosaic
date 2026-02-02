import { Loading } from '@/components/ui'
import { diariesApi } from '@/lib/api'
import { stringUtils } from '@/lib/utils/string'
import { useThemeStore } from '@/stores/theme-store'
import type { DiaryResponse } from '@/types/api'
import { FileX } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

interface DiaryFeedProps {
  onDiaryPress?: (diary: DiaryResponse) => void
}

const MOOD_CONFIG: Record<string, { emoji: string; color: string | ((theme: any) => string); label: string }> = {
  joy: { emoji: 'joy', color: '#FFD93D', label: '愉悦' },
  anger: { emoji: 'anger', color: '#FF6B6B', label: '愤怒' },
  sadness: { emoji: 'sadness', color: '#4ECDC4', label: '悲伤' },
  calm: { emoji: 'calm', color: '#95E1D3', label: '平静' },
  anxiety: { emoji: 'anxiety', color: '#FFA07A', label: '焦虑' },
  focus: { emoji: 'focus', color: '#6C5CE7', label: '专注' },
  tired: { emoji: 'tired', color: '#A8A8A8', label: '疲惫' },
  neutral: { emoji: 'neutral', color: 'NEUTRAL_COLOR', label: '中性' },
}

const MOOD_EMOJIS: Record<string, string> = {
  joy: '开心的',
  anger: '生气的',
  sadness: '悲伤的',
  calm: '平静的',
  anxiety: '焦虑的',
  focus: '专注的',
  tired: '疲惫的',
  neutral: '平淡的',
}

export function DiaryFeed({ onDiaryPress }: DiaryFeedProps) {
  const { theme } = useThemeStore()
  const [diaries, setDiaries] = useState<DiaryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const loadDiaries = useCallback(async () => {
    try {
      setLoading(true)
      const response = await diariesApi.list()
      setDiaries(response.items)
    } catch (error) {
      console.error('Failed to load diaries:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDiaries()
  }, [loadDiaries])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    loadDiaries()
  }, [loadDiaries])

  const getMoodEmoji = (moodKey?: string): string => {
    if (!moodKey) return '平淡的'
    return MOOD_EMOJIS[moodKey] || '平淡的'
  }

  const getMoodColor = (moodKey?: string): string => {
    if (!moodKey) return theme.border
    const config = MOOD_CONFIG[moodKey]
    if (!config) return theme.border
    const color = config.color
    if (typeof color === 'string') {
      if (color === 'NEUTRAL_COLOR') {
        return theme.border
      }
      return color
    }
    if (typeof color === 'function') {
      return color(theme)
    }
    return theme.border
  }

  const renderDiaryCard = ({ item }: { item: DiaryResponse; index: number }) => {
    const moodColor = getMoodColor(item.moodKey)

    return (
      <TouchableOpacity
        onPress={() => onDiaryPress?.(item)}
        activeOpacity={0.8}
        style={[
          styles.diaryCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.date, { color: theme.text }]}>
            {stringUtils.formatDate(item.date)}
          </Text>
          {item.moodKey && (
            <View style={[styles.moodBadge, { backgroundColor: `${moodColor}20` }]}>
              <Text style={styles.moodEmoji}>{getMoodEmoji(item.moodKey)}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.summary, { color: theme.textSecondary }]} numberOfLines={4}>
          {item.summary || '暂无内容'}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.viewMore, { color: theme.primary }]}>查看详情</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
        <FileX size={48} color={theme.primary} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>暂无日记</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        开始记录你的生活点滴
      </Text>
    </View>
  )

  const renderFooter = () => (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: theme.textSecondary }]}>没有更多了</Text>
    </View>
  )

  if (loading) {
    return <Loading text="加载中..." fullScreen />
  }

  if (diaries.length === 0) {
    return renderEmptyState()
  }

  return (
    <FlatList
      ref={flatListRef}
      data={diaries}
      renderItem={renderDiaryCard}
      keyExtractor={item => item.date}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      ListFooterComponent={renderFooter}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  diaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
  },
  moodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  moodEmoji: {
    fontSize: 14,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    marginTop: 'auto',
  },
  viewMore: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
})
