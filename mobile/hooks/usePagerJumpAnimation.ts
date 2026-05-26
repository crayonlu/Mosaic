import dayjs from 'dayjs'
import { Dimensions } from 'react-native'
import PagerView from 'react-native-pager-view'
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useCallback, useRef } from 'react'

const SCREEN_WIDTH = Dimensions.get('window').width

/** Jumps within this day range use step-by-step native page animation. */
const STEP_JUMP_THRESHOLD = 7

/** Interval between each step in a step-jump chain (ms). */
const STEP_INTERVAL_MS = 120

interface UsePagerJumpAnimationOptions {
  /** The PagerView ref used to trigger native page transitions. */
  pagerRef: React.RefObject<PagerView | null>
  /** Index of the centre slot (always the "current" page). */
  currentPageIndex: number
  /** Ref that mirrors `currentDate` for use inside callbacks without stale closures. */
  currentDateRef: React.RefObject<string>
  /** Ref that signals the scroll guard to swallow the next programmatic `onPageSelected`. */
  skipNextPageSelectedRef: React.RefObject<boolean>
  /** Ref tracking which native pager slot is currently active. */
  currentPageRef: React.RefObject<number>
  /** Ref that marks the scroll guard as busy (blocks concurrent user swipes). */
  isScrollingRef: React.RefObject<boolean>
  /** Called to commit a new date into the `useDiaryPager` state. */
  setCurrentDate: (date: string) => void
  /** Clamps/normalises a raw date string to a valid, non-future date. */
  normalizeDate: (date: string) => string
}

interface UsePagerJumpAnimationReturn {
  /** Animated style to apply to the slide overlay `Animated.View`. */
  overlayAnimStyle: ReturnType<typeof useAnimatedStyle>
  /**
   * The date to render inside the slide overlay.
   * Frozen to the pre-jump date so the overlay doesn't flicker when
   * `currentDate` updates mid-animation.
   */
  overlayDate: React.RefObject<string>
  /**
   * True while a programmatic jump is in progress.
   * The DiaryPagerScreen sync effect reads this to skip re-centring during animation.
   */
  isJumpingRef: React.RefObject<boolean>
  /**
   * Initiates an animated jump to `targetDate`.
   * - First call (cold start) is always instant — no animation.
   * - ≤ STEP_JUMP_THRESHOLD days: step-by-step native PagerView slide.
   * - > STEP_JUMP_THRESHOLD days: Reanimated slide overlay (out → swap → in).
   */
  animatedNavigateToDate: (targetDate: string) => void
}

/**
 * Encapsulates all animated date-jump logic for the diary pager:
 * - Small jumps (≤7 days): chain native `setPage` calls day-by-day at a fixed cadence.
 * - Large jumps (>7 days): Reanimated translateX slide-out → date swap → slide-in overlay.
 * - First-load guard: skips animation on cold start so the pager opens instantly.
 */
export function usePagerJumpAnimation({
  pagerRef,
  currentPageIndex,
  currentDateRef,
  skipNextPageSelectedRef,
  currentPageRef,
  isScrollingRef,
  setCurrentDate,
  normalizeDate,
}: UsePagerJumpAnimationOptions): UsePagerJumpAnimationReturn {
  const isFirstLoadRef = useRef(true)
  const stepJumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True while any animated jump is in progress — prevents the sync effect from
  // calling setPageWithoutAnimation and fighting the in-progress animation.
  const isJumpingRef = useRef(false)
  // Frozen to the pre-jump date so the overlay renders the correct "from" content
  // even after currentDate has already updated to the target.
  const overlayDate = useRef(currentDateRef.current ?? '')

  // Shared values for the slide overlay
  const overlayTranslateX = useSharedValue(0)
  const overlayOpacity = useSharedValue(0)

  const overlayAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: overlayTranslateX.value }],
    opacity: overlayOpacity.value,
  }))

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Snap the pager to the centre slot without animation (no native event emitted). */
  const snapToCenter = useCallback(() => {
    skipNextPageSelectedRef.current = true
    pagerRef.current?.setPageWithoutAnimation(currentPageIndex)
    currentPageRef.current = currentPageIndex
  }, [currentPageIndex, currentPageRef, pagerRef, skipNextPageSelectedRef])

  // ─── Large-jump: Reanimated slide overlay ───────────────────────────────────

  /**
   * Slides the current view out, swaps the date underneath, then slides the new view in.
   * `direction`: +1 = jumping forward (slide left), -1 = jumping backward (slide right).
   */
  const performSlideJump = useCallback(
    (targetDate: string, direction: 1 | -1) => {
      const exitX = -direction * SCREEN_WIDTH
      const enterX = direction * SCREEN_WIDTH

      // Freeze the overlay date to the current (pre-jump) date so it always
      // shows the correct "from" page even after currentDate has been updated.
      overlayDate.current = currentDateRef.current ?? ''
      isJumpingRef.current = true

      console.log('[SlideJump] START', {
        from: overlayDate.current,
        to: targetDate,
        direction,
        exitX,
        enterX,
      })

      // Reveal overlay at current position
      overlayTranslateX.value = 0
      overlayOpacity.value = 1

      // Slide current content out
      overlayTranslateX.value = withTiming(
        exitX,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        () => {
          // Swap the underlying date (invisible under the overlay)
          runOnJS(setCurrentDate)(targetDate)
          runOnJS(snapToCenter)()
          runOnJS(() =>
            console.log(
              '[SlideJump] MID — date swapped to',
              targetDate,
              'overlay still at',
              overlayDate.current
            )
          )()

          // Position overlay on the opposite side and slide it in
          overlayTranslateX.value = enterX
          overlayTranslateX.value = withTiming(
            0,
            { duration: 220, easing: Easing.out(Easing.cubic) },
            () => {
              // Fade out overlay to reveal the live PagerView content underneath
              overlayOpacity.value = withTiming(0, { duration: 80 }, () => {
                runOnJS(() => {
                  isJumpingRef.current = false
                  console.log('[SlideJump] DONE — overlay hidden, isJumping=false')
                })()
              })
            }
          )
        }
      )
    },
    [currentDateRef, overlayDate, overlayOpacity, overlayTranslateX, setCurrentDate, snapToCenter]
  )

  // ─── Small-jump: step-by-step native PagerView slides ───────────────────────

  /**
   * Chains native `setPage` calls, one day at a time, at a fixed cadence.
   * Each step advances the 5-slot window by 1 day and triggers the PagerView's
   * built-in slide animation to the adjacent slot, creating a "flipping pages" feel.
   */
  const performStepJump = useCallback(
    (targetDate: string, steps: number, direction: 1 | -1) => {
      if (stepJumpTimerRef.current) clearTimeout(stepJumpTimerRef.current)
      isScrollingRef.current = true
      isJumpingRef.current = true

      const originDate = currentDateRef.current ?? ''
      console.log('[StepJump] START', { from: originDate, to: targetDate, steps, direction })

      const doStep = (stepIndex: number) => {
        if (stepIndex >= steps) {
          // Final step: commit the exact target date and snap to centre
          console.log('[StepJump] FINAL — setting', targetDate)
          setCurrentDate(targetDate)
          snapToCenter()
          isScrollingRef.current = false
          isJumpingRef.current = false
          return
        }

        // Advance the window by one more day, clamped to a safe (non-future) date
        const rawDate = dayjs(originDate)
          .add((stepIndex + 1) * direction, 'day')
          .format('YYYY-MM-DD')
        const intermediateDate = normalizeDate(rawDate)
        console.log(
          `[StepJump] step ${stepIndex + 1}/${steps} — setCurrentDate(${intermediateDate}), slot → ${currentPageIndex + direction}`
        )
        setCurrentDate(intermediateDate)

        // After the window re-renders, trigger the native slide to the next slot
        stepJumpTimerRef.current = setTimeout(() => {
          skipNextPageSelectedRef.current = true
          pagerRef.current?.setPage(currentPageIndex + direction)
          stepJumpTimerRef.current = setTimeout(() => {
            doStep(stepIndex + 1)
          }, STEP_INTERVAL_MS)
        }, 16) // one frame for React to commit the state update
      }

      doStep(0)
    },
    [
      currentDateRef,
      currentPageIndex,
      isScrollingRef,
      normalizeDate,
      pagerRef,
      setCurrentDate,
      skipNextPageSelectedRef,
      snapToCenter,
    ]
  )

  // ─── Public API ─────────────────────────────────────────────────────────────

  const animatedNavigateToDate = useCallback(
    (targetDate: string) => {
      const safeTarget = normalizeDate(targetDate)
      if (safeTarget === currentDateRef.current) {
        console.log('[Jump] SKIP — already at', safeTarget)
        return
      }

      // Cold start: open instantly, mark first load as done
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false
        console.log('[Jump] COLD START — instant jump to', safeTarget)
        setCurrentDate(safeTarget)
        snapToCenter()
        return
      }

      const delta = dayjs(safeTarget).diff(dayjs(currentDateRef.current), 'day')
      const absDelta = Math.abs(delta)
      const direction = delta >= 0 ? 1 : -1

      console.log('[Jump] NAVIGATE', {
        from: currentDateRef.current,
        to: safeTarget,
        delta,
        strategy: absDelta <= STEP_JUMP_THRESHOLD ? 'step' : 'slide',
      })

      if (absDelta <= STEP_JUMP_THRESHOLD) {
        performStepJump(safeTarget, absDelta, direction as 1 | -1)
      } else {
        performSlideJump(safeTarget, direction as 1 | -1)
      }
    },
    [currentDateRef, normalizeDate, performSlideJump, performStepJump, setCurrentDate, snapToCenter]
  )

  return { overlayAnimStyle, overlayDate, isJumpingRef, animatedNavigateToDate }
}
