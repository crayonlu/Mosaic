import { DiaryFeed } from '@/components/diary/DiaryFeed'
import type { DiaryResponse } from '@/types/api'
import { router } from 'expo-router'

export default function DiariesScreen() {
  const handleDiaryPress = (diary: DiaryResponse) => {
    router.push({ pathname: '/diary/[date]', params: { date: diary.date } })
  }

  return <DiaryFeed onDiaryPress={handleDiaryPress} />
}
