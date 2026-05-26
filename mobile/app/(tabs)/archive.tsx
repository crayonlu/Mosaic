import { ArchiveDateFilter } from '@/components/archive/ArchiveDateFilter'
import { ArchiveDialog, type ArchiveDialogRef } from '@/components/archive/ArchiveDialog'
import { MemoFeed } from '@/components/archive/MemoFeed'
import { useDeleteMemo, useDiary } from '@/lib/query'
import { useThemeStore } from '@/stores/themeStore'
import type { MemoWithResources } from '@mosaic/api'
import dayjs from 'dayjs'
import { router } from 'expo-router'
import { Check, X } from 'lucide-react-native'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type ArchivePhase = 'browsing' | 'selecting' | 'confirming'

type ArchiveState = {
  phase: ArchivePhase
  selectedIds: string[]
}

type ArchiveAction =
  | { type: 'PRESS_ARCHIVE_BUTTON' }
  | { type: 'TOGGLE_MEMO'; id: string }
  | { type: 'CONFIRM_SUCCESS' }
  | { type: 'SHEET_CLOSED' }

const initialState: ArchiveState = { phase: 'browsing', selectedIds: [] }

function archiveReducer(state: ArchiveState, action: ArchiveAction): ArchiveState {
  switch (action.type) {
    case 'PRESS_ARCHIVE_BUTTON':
      switch (state.phase) {
        case 'browsing':
          return { phase: 'selecting', selectedIds: [] }
        case 'selecting':
          return state.selectedIds.length > 0
            ? { phase: 'confirming', selectedIds: state.selectedIds }
            : { phase: 'browsing', selectedIds: [] }
        default:
          return state
      }

    case 'TOGGLE_MEMO':
      if (state.phase !== 'selecting') return state
      return {
        ...state,
        selectedIds: state.selectedIds.includes(action.id)
          ? state.selectedIds.filter(id => id !== action.id)
          : [...state.selectedIds, action.id],
      }

    case 'CONFIRM_SUCCESS':
      return initialState

    case 'SHEET_CLOSED':
      if (state.phase === 'confirming') {
        return { ...state, phase: 'selecting' }
      }
      return state

    default:
      return state
  }
}

export default function ArchiveScreen() {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const dialogRef = useRef<ArchiveDialogRef>(null)
  const [selectedDate, setSelectedDate] = useState<string | undefined>(dayjs().format('YYYY-MM-DD'))
  const [visibleMemos, setVisibleMemos] = useState<MemoWithResources[]>([])

  const [dialogMemos, setDialogMemos] = useState<MemoWithResources[]>([])

  const { mutateAsync: deleteMemo } = useDeleteMemo()
  const [archiveState, dispatch] = useReducer(archiveReducer, initialState)

  const today = dayjs().format('YYYY-MM-DD')
  const { data: todayDiary } = useDiary(today)

  useEffect(() => {
    if (archiveState.phase === 'confirming') {
      dialogRef.current?.present()
    }
  }, [archiveState.phase])

  const selectedMemoIds = archiveState.selectedIds
  const isSelectionMode = archiveState.phase !== 'browsing'

  const selectedMemos = useMemo(() => {
    return visibleMemos.filter(m => selectedMemoIds.includes(m.id))
  }, [visibleMemos, selectedMemoIds])

  const validSelectedCount = archiveState.phase === 'browsing' ? 0 : selectedMemos.length
  const hasSelection = validSelectedCount > 0

  const handleMemoPress = (memo: MemoWithResources) => {
    if (archiveState.phase === 'browsing')
      router.push({ pathname: '/memo/[id]', params: { id: memo.id } })
  }

  const handleMemoDelete = (id: string) => {
    deleteMemo(id)
  }

  const handleArchivePress = () => {
    if (archiveState.phase === 'selecting') {
      if (validSelectedCount === 0) {
        dispatch({ type: 'CONFIRM_SUCCESS' })
        return
      }
      setDialogMemos(selectedMemos)
    }
    dispatch({ type: 'PRESS_ARCHIVE_BUTTON' })
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.topArea}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{t('tabs.archive')}</Text>
            <Text style={[styles.headerSubTitle, { color: theme.textSecondary }]}>
              {t('archive.subtitle')}
              {isSelectionMode ? ` · ${t('archive.selected', { count: validSelectedCount })}` : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.archiveActionButton,
              {
                backgroundColor: hasSelection ? theme.primary : theme.surfaceMuted,
                borderRadius: theme.radius.medium,
              },
            ]}
            onPress={handleArchivePress}
            activeOpacity={theme.state.pressedOpacity}
          >
            {hasSelection ? (
              <Check size={18} color={theme.onPrimary} />
            ) : isSelectionMode ? (
              <X size={18} color={theme.textSecondary} />
            ) : null}
            <Text
              style={[
                styles.archiveActionText,
                { color: hasSelection ? theme.onPrimary : theme.textSecondary },
              ]}
            >
              {hasSelection
                ? t('archive.archive')
                : isSelectionMode
                  ? t('common.cancel')
                  : t('archive.archive')}
            </Text>
          </TouchableOpacity>
        </View>

        <ArchiveDateFilter selectedDate={selectedDate} onDateSelect={setSelectedDate} />
      </View>

      <View style={{ flex: 1 }}>
        <MemoFeed
          targetDate={selectedDate}
          onMemoPress={handleMemoPress}
          onMemoDelete={handleMemoDelete}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedMemoIds}
          onSelectionChange={id => dispatch({ type: 'TOGGLE_MEMO', id })}
          onMemosChange={setVisibleMemos}
        />
      </View>
      <ArchiveDialog
        ref={dialogRef}
        selectedMemos={dialogMemos}
        targetDate={selectedDate || today}
        existingDiary={selectedDate === today ? todayDiary : undefined}
        onSuccess={() => {
          dispatch({ type: 'CONFIRM_SUCCESS' })
          setDialogMemos([])
        }}
        onCancel={() => dialogRef.current?.dismiss()}
        onDismiss={() => dispatch({ type: 'SHEET_CLOSED' })}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topArea: {
    paddingBottom: 4,
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 2,
  },
  headerSubTitle: {
    fontSize: 12,
  },
  archiveActionButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  archiveActionText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
