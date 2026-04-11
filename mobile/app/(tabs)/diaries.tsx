import { DiaryPagerScreen } from '@/components/diary/DiaryPagerScreen'
import { useLocalSearchParams } from 'expo-router'

export default function DiariesScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>()

  if (__DEV__) {
    console.log('[DiariesScreen] route param', {
      date,
      type: typeof date,
      isArray: Array.isArray(date),
    })
  }

  return <DiaryPagerScreen initialDate={date} />
}
