import { DiaryPagerScreen } from '@/components/diary/DiaryPagerScreen'
import { useLocalSearchParams } from 'expo-router'

export default function DiariesScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>()
  console.log('DiariesScreen params:', { date })
  return <DiaryPagerScreen initialDate={date} />
}
