import { useThemeStore } from '@/stores/themeStore'
import { CleanSlateTheme, QuietPaperTheme, type Theme, type ThemeName } from '@/constants/theme'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Check } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, FadeInUp } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ThemePreviewCardProps {
  name: ThemeName
  label: string
  description: string
  theme: Theme
  selected: boolean
  onSelect: () => void
  enterDelay: number
}

function ThemePreviewCard({
  name,
  label,
  description,
  theme,
  selected,
  onSelect,
  enterDelay,
}: ThemePreviewCardProps) {
  return (
    <Animated.View
      style={{ flex: 1 }}
      entering={FadeInUp.delay(enterDelay)
        .duration(300)
        .easing(Easing.bezier(0.25, 1, 0.5, 1))}
    >
      <Pressable
        onPress={onSelect}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: selected ? theme.primary : 'transparent',
            borderWidth: 2,
            borderRadius: 16,
          },
        ]}
      >
        {name === 'quietPaper' && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderRadius: 16, overflow: 'hidden' }]}
          >
            <Image
              source={require('@/assets/images/noise.png')}
              contentFit="cover"
              style={{ width: '100%', height: '100%', opacity: 0.5 }}
            />
          </View>
        )}
        {selected && (
          <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
            <Check size={14} color={theme.onPrimary} strokeWidth={3} />
          </View>
        )}

        <View style={styles.cardContent}>
          <Text style={[styles.cardLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
            {description}
          </Text>

          {/* Mini MemoCard sample */}
          <View
            style={[
              styles.sampleCard,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                borderRadius: name === 'quietPaper' ? 14 : 8,
                ...(name === 'quietPaper' ? theme.shadows.subtle : {}),
              },
            ]}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: theme.typography.body.fontSize,
                fontWeight: theme.typography.body.fontWeight,
                lineHeight: theme.typography.body.lineHeight,
              }}
            >
              今天阳光很好，在阳台上读了一会儿书...
            </Text>
            <View style={styles.sampleTags}>
              <View style={[styles.sampleTag, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.sampleTagText, { color: theme.textSecondary }]}>日常</Text>
              </View>
              <View style={[styles.sampleTag, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.sampleTagText, { color: theme.textSecondary }]}>阅读</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

export default function ThemePickerScreen() {
  const insets = useSafeAreaInsets()
  const { setThemeName } = useThemeStore()
  const [selected, setSelected] = useState<ThemeName | null>(null)

  const handleContinue = () => {
    if (!selected) return
    setThemeName(selected)
    router.replace('/setup')
  }

  const pageTheme = QuietPaperTheme

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: pageTheme.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: pageTheme.text }]}>选择主题风格</Text>
        <Text style={[styles.subtitle, { color: pageTheme.textSecondary }]}>
          你可以随时在设置中更改
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        <ThemePreviewCard
          name="quietPaper"
          label="暖纸"
          description="书房质感，温暖沉稳"
          theme={QuietPaperTheme}
          selected={selected === 'quietPaper'}
          onSelect={() => setSelected('quietPaper')}
          enterDelay={0}
        />
        <ThemePreviewCard
          name="cleanSlate"
          label="清素"
          description="笔记极简，清晰克制"
          theme={CleanSlateTheme}
          selected={selected === 'cleanSlate'}
          onSelect={() => setSelected('cleanSlate')}
          enterDelay={80}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          style={[
            styles.continueButton,
            {
              backgroundColor: selected
                ? (selected === 'quietPaper' ? QuietPaperTheme : CleanSlateTheme).primary
                : pageTheme.surfaceMuted,
              borderRadius: 12,
              opacity: selected ? 1 : 0.5,
            },
          ]}
        >
          <Text
            style={[
              styles.continueText,
              {
                color: selected
                  ? (selected === 'quietPaper' ? QuietPaperTheme : CleanSlateTheme).onPrimary
                  : pageTheme.textSecondary,
              },
            ]}
          >
            开始使用
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
  },
  cardsContainer: {
    flex: 1,
    gap: 16,
  },
  card: {
    flex: 1,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 16,
  },
  sampleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  sampleTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  sampleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sampleTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  footer: {
    paddingTop: 16,
  },
  continueButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 17,
    fontWeight: '600',
  },
})
