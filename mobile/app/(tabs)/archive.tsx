/**
 * Archive Tab - History & Timeline View
 */

import { ArchiveDateFilter } from '@/components/archive/ArchiveDateFilter'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { useThemeStore } from '@/stores/theme-store'
import type { MemoWithResources } from '@/types/memo'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

export default function ArchiveScreen() {
  const { theme } = useThemeStore()
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)

  const handleMemoPress = (memo: MemoWithResources) => {
    router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleMemoArchive = (id: string) => {
    console.log('Archive memo:', id)
  }

  const handleMemoDelete = (id: string) => {
    console.log('Delete memo:', id)
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ArchiveDateFilter selectedDate={selectedDate} onDateSelect={setSelectedDate} />
      <MemoFeed
        targetDate={selectedDate}
        onMemoPress={handleMemoPress}
        onMemoArchive={handleMemoArchive}
        onMemoDelete={handleMemoDelete}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
})
