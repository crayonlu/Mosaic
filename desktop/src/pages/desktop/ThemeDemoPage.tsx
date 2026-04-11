import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  QUIET_PAPER_DARK,
  QUIET_PAPER_LIGHT,
  QUIET_PAPER_MOOD_COLORS,
  type ThemeScale,
} from '@mosaic/utils'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'

type Tone = {
  name: string
  value: string
  usage: string
}

type Palette = {
  mode: 'light' | 'dark'
  label: string
  scale: ThemeScale
  tokens: Tone[]
}

const lightPalette: Palette = {
  mode: 'light',
  label: 'Quiet Paper / Light',
  scale: QUIET_PAPER_LIGHT,
  tokens: [
    { name: 'Background', value: QUIET_PAPER_LIGHT.background, usage: 'App page background' },
    { name: 'Surface', value: QUIET_PAPER_LIGHT.surface, usage: 'Cards and panels' },
    { name: 'Text', value: QUIET_PAPER_LIGHT.text, usage: 'Primary text' },
    { name: 'Text Secondary', value: QUIET_PAPER_LIGHT.textSecondary, usage: 'Secondary text' },
    { name: 'Border', value: QUIET_PAPER_LIGHT.border, usage: 'Input and divider border' },
    { name: 'Primary', value: QUIET_PAPER_LIGHT.primary, usage: 'Brand action color' },
    {
      name: 'Primary Accent',
      value: QUIET_PAPER_LIGHT.primaryAccent,
      usage: 'Hover and active accents',
    },
    { name: 'Info', value: QUIET_PAPER_LIGHT.info, usage: 'Informational states' },
    { name: 'Success', value: QUIET_PAPER_LIGHT.success, usage: 'Success states' },
    { name: 'Error', value: QUIET_PAPER_LIGHT.error, usage: 'Error states' },
  ],
}

const darkPalette: Palette = {
  mode: 'dark',
  label: 'Quiet Paper / Dark',
  scale: QUIET_PAPER_DARK,
  tokens: [
    { name: 'Background', value: QUIET_PAPER_DARK.background, usage: 'App page background' },
    { name: 'Surface', value: QUIET_PAPER_DARK.surface, usage: 'Cards and panels' },
    { name: 'Text', value: QUIET_PAPER_DARK.text, usage: 'Primary text' },
    { name: 'Text Secondary', value: QUIET_PAPER_DARK.textSecondary, usage: 'Secondary text' },
    { name: 'Border', value: QUIET_PAPER_DARK.border, usage: 'Input and divider border' },
    { name: 'Primary', value: QUIET_PAPER_DARK.primary, usage: 'Brand action color' },
    {
      name: 'Primary Accent',
      value: QUIET_PAPER_DARK.primaryAccent,
      usage: 'Hover and active accents',
    },
    { name: 'Info', value: QUIET_PAPER_DARK.info, usage: 'Informational states' },
    { name: 'Success', value: QUIET_PAPER_DARK.success, usage: 'Success states' },
    { name: 'Error', value: QUIET_PAPER_DARK.error, usage: 'Error states' },
  ],
}

const moodPalette: Tone[] = [
  { name: 'Joy', value: QUIET_PAPER_MOOD_COLORS.joy, usage: 'Warm bright emotion' },
  { name: 'Calm', value: QUIET_PAPER_MOOD_COLORS.calm, usage: 'Stable restful state' },
  { name: 'Focus', value: QUIET_PAPER_MOOD_COLORS.focus, usage: 'Deep concentration' },
  { name: 'Anxiety', value: QUIET_PAPER_MOOD_COLORS.anxiety, usage: 'Tension and unease' },
  { name: 'Sadness', value: QUIET_PAPER_MOOD_COLORS.sadness, usage: 'Low-energy reflection' },
  { name: 'Anger', value: QUIET_PAPER_MOOD_COLORS.anger, usage: 'High-intensity warning' },
  { name: 'Tired', value: QUIET_PAPER_MOOD_COLORS.tired, usage: 'Energy depletion' },
  { name: 'Neutral', value: QUIET_PAPER_MOOD_COLORS.neutral, usage: 'Baseline state' },
]

function TokenCard({ tone, dark = false }: { tone: Tone; dark?: boolean }) {
  const textColor = dark ? '#F4EFE7' : '#1F2430'
  const subTextColor = dark ? '#B8B0A3' : '#667085'

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: dark ? '#3A352D' : '#D9D2C6',
        backgroundColor: dark ? '#1F1F22' : '#F2ECE2',
      }}
    >
      <div
        className="h-16 rounded-lg border"
        style={{ backgroundColor: tone.value, borderColor: '#00000022' }}
      />
      <div className="mt-3 space-y-1">
        <p className="text-sm font-semibold" style={{ color: textColor }}>
          {tone.name}
        </p>
        <p className="text-xs font-mono" style={{ color: subTextColor }}>
          {tone.value}
        </p>
        <p className="text-xs" style={{ color: subTextColor }}>
          {tone.usage}
        </p>
      </div>
    </div>
  )
}

function PaletteSection({ palette }: { palette: Palette }) {
  const dark = palette.mode === 'dark'
  const scale = palette.scale

  return (
    <Card
      style={{
        backgroundColor: scale.background,
        borderColor: scale.border,
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: scale.text }}>
          {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {palette.label}
        </CardTitle>
        <CardDescription style={{ color: scale.textSecondary }}>
          用一套更温和、更一致的品牌色，统一桌面端和移动端体验。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {palette.tokens.map(tone => (
            <TokenCard key={`${palette.mode}-${tone.name}`} tone={tone} dark={dark} />
          ))}
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: scale.border,
            backgroundColor: scale.surface,
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: scale.text }}>
              组件预览
            </p>
            <Badge
              variant="outline"
              style={{
                borderColor: scale.border,
                color: scale.text,
              }}
            >
              Quiet Paper
            </Badge>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <Button style={{ backgroundColor: scale.primary, color: scale.onPrimary }}>
              Primary Action
            </Button>
            <Button
              variant="outline"
              style={{
                borderColor: scale.border,
                color: scale.text,
              }}
            >
              Secondary
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: dark ? '#2A1D1D' : '#FCEAEA', color: scale.error }}
            >
              Error / Danger tone
            </div>
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: dark ? '#1D2A24' : '#E9F7F0', color: scale.success }}
            >
              Success tone
            </div>
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: dark ? '#1D2330' : '#EAF1FA', color: scale.info }}
            >
              Info tone
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ThemeDemoPage() {
  return (
    <div
      className="min-h-screen p-6 md:p-10"
      style={{
        background:
          'radial-gradient(1200px 600px at 10% -10%, #EADCC8 0%, transparent 60%), radial-gradient(900px 600px at 100% 0%, #1D2D48 0%, transparent 55%), linear-gradient(180deg, #F8F5EF 0%, #EFE8DD 100%)',
      }}
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
              Mosaic Design Study
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-neutral-900">跨端配色演示页</h1>
            <p className="mt-2 text-sm text-neutral-700">
              这是我为“小而美”方向提出的 Quiet Paper
              方案。你可以先看整体气质，再决定是否替换当前主题。
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-700 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            返回主页
          </Link>
        </div>

        <PaletteSection palette={lightPalette} />
        <PaletteSection palette={darkPalette} />

        <Card
          style={{
            backgroundColor: QUIET_PAPER_LIGHT.background,
            borderColor: QUIET_PAPER_LIGHT.border,
          }}
        >
          <CardHeader>
            <CardTitle style={{ color: QUIET_PAPER_LIGHT.text }}>
              情绪色建议（可替换现有 mood 颜色）
            </CardTitle>
            <CardDescription style={{ color: QUIET_PAPER_LIGHT.textSecondary }}>
              保留情绪区分，但把高饱和度收敛，避免与品牌主视觉冲突。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {moodPalette.map(tone => (
                <TokenCard key={`mood-${tone.name}`} tone={tone} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
