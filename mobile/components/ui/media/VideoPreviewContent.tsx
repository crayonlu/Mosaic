import { useThemeStore } from '@/stores/themeStore'
import { useEvent } from 'expo'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Pause, Play } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { formatPlaybackTime, safelyControlPlayer, withAlpha } from './mediaPreviewUtils'

interface VideoPreviewContentProps {
  uri: string
  headers?: Record<string, string>
  thumbnailUri?: string
  thumbnailHeaders?: Record<string, string>
  isActive: boolean
}

export function VideoPreviewContent({
  uri,
  headers,
  thumbnailUri,
  thumbnailHeaders,
  isActive,
}: VideoPreviewContentProps) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const [isReady, setIsReady] = useState(false)
  const [hasEnded, setHasEnded] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [progressTrackWidth, setProgressTrackWidth] = useState(0)
  const loadingOverlayColor = useMemo(() => withAlpha(theme.background, 0.24), [theme.background])
  const centerControlColor = useMemo(() => withAlpha(theme.background, 0.52), [theme.background])
  const centerControlPressedColor = useMemo(
    () => withAlpha(theme.background, 0.68),
    [theme.background]
  )
  const mediaTintColor = useMemo(() => withAlpha(theme.text, 0.98), [theme.text])
  const controlsCardColor = useMemo(() => withAlpha(theme.surface, 0.92), [theme.surface])
  const progressBackgroundColor = useMemo(
    () => withAlpha(theme.textSecondary, 0.22),
    [theme.textSecondary]
  )
  const progressBufferedColor = useMemo(() => withAlpha(theme.primary, 0.32), [theme.primary])
  const thumbnailMaskColor = useMemo(() => withAlpha(theme.background, 0.08), [theme.background])
  const [playerSourceUri] = useState(uri)
  const [thumbnailSourceUri] = useState(thumbnailUri)

  const player = useVideoPlayer(
    {
      uri: playerSourceUri,
      headers,
    },
    videoPlayer => {
      videoPlayer.loop = false
      videoPlayer.timeUpdateEventInterval = 0.25
    }
  )
  const { currentTime = 0, bufferedPosition = 0 } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0
  const playedRatio = duration > 0 ? Math.min(currentTime / duration, 1) : 0
  const bufferedRatio = duration > 0 ? Math.min(bufferedPosition / duration, 1) : 0
  const shouldShowControls = isActive && (controlsVisible || !isReady || !isPlaying)

  useEffect(() => {
    if (isActive) {
      setControlsVisible(true)
      return
    }

    safelyControlPlayer(() => {
      player.pause()
    })
  }, [isActive, player])

  useEffect(() => {
    if (!isActive || hasEnded) {
      return
    }

    safelyControlPlayer(() => {
      player.play()
    })
  }, [hasEnded, isActive, player])

  useEffect(() => {
    if (!isActive || !isReady || !isPlaying || !controlsVisible) {
      return
    }

    const timer = setTimeout(() => {
      setControlsVisible(false)
    }, 2500)

    return () => clearTimeout(timer)
  }, [controlsVisible, isActive, isPlaying, isReady])

  useEffect(() => {
    if (duration <= 0) {
      return
    }

    const isAtEnd = currentTime >= duration - 0.15
    if (isAtEnd && !isPlaying) {
      setHasEnded(true)
      setControlsVisible(true)
      return
    }

    if (!isAtEnd && hasEnded) {
      setHasEnded(false)
    }
  }, [currentTime, duration, hasEnded, isPlaying])

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      safelyControlPlayer(() => {
        player.pause()
      })
      return
    }

    safelyControlPlayer(() => {
      if (hasEnded || (duration > 0 && currentTime >= duration - 0.15)) {
        player.currentTime = 0
      }
      player.play()
    })
    setHasEnded(false)
    setControlsVisible(true)
  }, [currentTime, duration, hasEnded, isPlaying, player])

  const handleToggleControls = useCallback(() => {
    if (!isActive || !isReady) {
      return
    }

    setControlsVisible(visible => !visible)
  }, [isActive, isReady])

  const handleProgressLayout = useCallback((event: LayoutChangeEvent) => {
    setProgressTrackWidth(event.nativeEvent.layout.width)
  }, [])

  const handleSeek = useCallback(
    (pressX: number) => {
      if (duration <= 0 || progressTrackWidth <= 0) {
        return
      }

      const ratio = Math.max(0, Math.min(pressX / progressTrackWidth, 1))
      safelyControlPlayer(() => {
        player.currentTime = ratio * duration
      })
      setHasEnded(false)
      setControlsVisible(true)
    },
    [duration, player, progressTrackWidth]
  )

  return (
    <View style={styles.container}>
      {!isReady && thumbnailSourceUri ? (
        <View style={styles.thumbnailOverlay} pointerEvents="none">
          <Image
            source={{ uri: thumbnailSourceUri, headers: thumbnailHeaders }}
            style={styles.thumbnail}
            contentFit="contain"
          />
          <View style={[styles.thumbnailMask, { backgroundColor: thumbnailMaskColor }]} />
        </View>
      ) : null}

      <VideoView
        player={player}
        style={styles.videoView}
        nativeControls={false}
        contentFit="contain"
        surfaceType="textureView"
        onFirstFrameRender={() => setIsReady(true)}
      />

      {!isReady && isActive ? (
        <View
          style={[styles.loadingOverlay, { backgroundColor: loadingOverlayColor }]}
          pointerEvents="none"
        >
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>视频加载中...</Text>
        </View>
      ) : null}

      {isActive ? (
        <Pressable style={styles.tapLayer} onPress={handleToggleControls}>
          {shouldShowControls ? (
            <>
              {isReady ? (
                <View style={styles.centerControlWrap} pointerEvents="box-none">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isPlaying ? '暂停视频' : '播放视频'}
                    onPress={handleTogglePlayback}
                    style={({ pressed }) => [
                      styles.centerControl,
                      {
                        backgroundColor: pressed ? centerControlPressedColor : centerControlColor,
                      },
                    ]}
                  >
                    {isPlaying ? (
                      <Pause size={26} color={mediaTintColor} />
                    ) : (
                      <Play size={26} color={mediaTintColor} fill={mediaTintColor} />
                    )}
                  </Pressable>
                </View>
              ) : null}

              {isReady ? (
                <View
                  style={[
                    styles.bottomControls,
                    {
                      paddingBottom: 14 + insets.bottom,
                      backgroundColor: controlsCardColor,
                    },
                  ]}
                >
                  <View style={styles.timeRow}>
                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                      {formatPlaybackTime(currentTime)}
                    </Text>
                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                      {status === 'loading' ? '加载中' : formatPlaybackTime(duration)}
                    </Text>
                  </View>

                  <Pressable
                    onLayout={handleProgressLayout}
                    onPress={event => handleSeek(event.nativeEvent.locationX)}
                    style={[styles.progressTrack, { backgroundColor: progressBackgroundColor }]}
                  >
                    <View
                      pointerEvents="none"
                      style={[
                        styles.progressBuffered,
                        {
                          width: `${bufferedRatio * 100}%`,
                          backgroundColor: progressBufferedColor,
                        },
                      ]}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.progressPlayed,
                        {
                          width: `${playedRatio * 100}%`,
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailMask: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 3,
  },
  centerControlWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerControl: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBuffered: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  progressPlayed: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
})
