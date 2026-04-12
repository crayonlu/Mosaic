import { DiaryPagerScreen } from '@/components/diary/DiaryPagerScreen'
import { useLocalSearchParams } from 'expo-router'

export default function DiariesScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>()
  return <DiaryPagerScreen initialDate={date} />
}
