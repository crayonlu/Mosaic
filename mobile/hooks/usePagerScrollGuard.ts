import { useCallback, useRef } from 'react'
import PagerView from 'react-native-pager-view'

interface UsePagerScrollGuardOptions {
  /** The ref to the PagerView instance. */
  pagerRef: React.RefObject<PagerView | null>
  /** The slot index that is always considered "current" (centre of the window). */
  currentPageIndex: number
  /** External ref tracking which native pager slot is currently active. Owned by the caller. */
  currentPageRef: React.RefObject<number>
  /**
   * Called when a swipe fully settles (idle) to commit the new date into React state.
   * Includes the slot index the pager is physically sitting on, so displayDates can be
   * rebuilt centred on that slot — eliminating the need for a snap-back.
   */
  onNavigate: (date: string, slotIndex: number) => void
  /**
   * Called immediately on onPageSelected (during settling) with the target date.
   * Use this to update UI elements like the header without triggering a displayDates rebuild.
   */
  onPreviewDate: (date: string) => void
  /** The current ordered list of dates mapped to pager slots. */
  displayDates: string[]
}

interface UsePagerScrollGuardReturn {
  isScrollingRef: React.RefObject<boolean>
  skipNextPageSelectedRef: React.RefObject<boolean>
  pendingRouteDateRef: React.RefObject<string | null>
  handlePageScrollStateChanged: (e: { nativeEvent: { pageScrollState: string } }) => void
  handlePageSelected: (e: { nativeEvent: { position: number } }) => void
}

/**
 * Manages the PagerView scroll state lifecycle:
 *
 * Key invariant: `onNavigate` (which rebuilds displayDates) is only called AFTER the pager
 * reaches `idle`. This prevents the pager from snapping mid-animation because displayDates
 * was rebuilt while the native settle was still running.
 *
 * `onPreviewDate` is called immediately on `onPageSelected` so the header date updates
 * in real time without causing a displayDates rebuild.
 */
export function usePagerScrollGuard({
  pagerRef,
  currentPageIndex,
  currentPageRef,
  onNavigate,
  onPreviewDate,
  displayDates,
}: UsePagerScrollGuardOptions): UsePagerScrollGuardReturn {
  const isScrollingRef = useRef(false)
  const skipNextPageSelectedRef = useRef(false)
  const pendingRouteDateRef = useRef<string | null>(null)
  // The date the user has swiped to — committed on idle
  const pendingNavigateDateRef = useRef<string | null>(null)
  const pendingSlotIndexRef = useRef<number>(currentPageIndex)

  const handlePageScrollStateChanged = useCallback(
    (e: { nativeEvent: { pageScrollState: string } }) => {
      const state = e.nativeEvent.pageScrollState
      if (state === 'dragging' || state === 'settling') {
        isScrollingRef.current = true
      } else {
        // idle — safe to rebuild displayDates now
        isScrollingRef.current = false
        if (pendingNavigateDateRef.current) {
          const date = pendingNavigateDateRef.current
          const slot = pendingSlotIndexRef.current
          pendingNavigateDateRef.current = null
          console.log('[FLASH] pageScrollState: idle → committing', date, 'at slot', slot)
          onNavigate(date, slot)
        } else {
          console.log('[FLASH] pageScrollState: idle, no pending navigate')
        }
      }
    },
    [onNavigate]
  )

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const newIndex = e.nativeEvent.position
      // A deep-link jump is in progress — force the pager back to centre and ignore this event.
      if (pendingRouteDateRef.current && newIndex !== currentPageIndex) {
        skipNextPageSelectedRef.current = true
        pagerRef.current?.setPageWithoutAnimation(currentPageIndex)
        currentPageRef.current = currentPageIndex
        return
      }

      currentPageRef.current = newIndex

      // This event was triggered programmatically (not by the user) — swallow it.
      if (skipNextPageSelectedRef.current) {
        skipNextPageSelectedRef.current = false
        if (pendingRouteDateRef.current && newIndex === currentPageIndex) {
          pendingRouteDateRef.current = null
        }
        return
      }

      const targetDate = displayDates[newIndex]
      if (!targetDate) return
      if (pendingRouteDateRef.current && targetDate !== pendingRouteDateRef.current) return
      if (pendingRouteDateRef.current && targetDate === pendingRouteDateRef.current) {
        pendingRouteDateRef.current = null
      }

      // Preview the date immediately so header updates in real time.
      // Do NOT call onNavigate here — that would rebuild displayDates mid-animation.
      console.log(
        '[FLASH] onPageSelected idx:',
        newIndex,
        'targetDate:',
        targetDate,
        '| displayDates:',
        JSON.stringify(displayDates)
      )
      onPreviewDate(targetDate)
      pendingNavigateDateRef.current = targetDate
      pendingSlotIndexRef.current = newIndex
    },
    [currentPageIndex, displayDates, onNavigate, onPreviewDate, pagerRef]
  )

  return {
    isScrollingRef,
    skipNextPageSelectedRef,
    pendingRouteDateRef,
    handlePageScrollStateChanged,
    handlePageSelected,
  }
}
