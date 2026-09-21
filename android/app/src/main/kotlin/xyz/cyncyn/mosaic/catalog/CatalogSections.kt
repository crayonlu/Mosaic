package xyz.cyncyn.mosaic.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import kotlin.math.pow
import xyz.cyncyn.mosaic.design.component.MoodChip
import xyz.cyncyn.mosaic.design.component.MosaicButton
import xyz.cyncyn.mosaic.design.component.MosaicButtonVariant
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.design.token.MoodKey

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

private fun Color.asHex(): String = "#%06X".format(toArgb() and 0xFFFFFF)

private fun wcagContrast(foreground: Color, background: Color): Float {
    fun channel(c: Float): Float =
        if (c <= 0.03928f) c / 12.92f else (((c + 0.055f) / 1.055f).toDouble().pow(2.4)).toFloat()

    fun luminance(c: Color): Float =
        0.2126f * channel(c.red) + 0.7152f * channel(c.green) + 0.0722f * channel(c.blue)

    val lighter = maxOf(luminance(foreground), luminance(background))
    val darker = minOf(luminance(foreground), luminance(background))
    return (lighter + 0.05f) / (darker + 0.05f)
}

@Composable
internal fun SectionTitle(text: String) {
    MosaicText(
        text = text,
        style = MosaicTheme.typography.title,
        color = MosaicTheme.colors.text,
        modifier = Modifier.padding(bottom = 14.dp),
    )
}

@Composable
private fun SectionGroup(name: String, content: @Composable () -> Unit) {
    Column {
        MosaicText(
            text = name,
            style = MosaicTheme.typography.label,
            color = MosaicTheme.colors.textSecondary,
            modifier = Modifier.padding(bottom = 10.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
    }
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

@Composable
internal fun ColorSection() {
    val colors = MosaicTheme.colors
    val canvas = colors.background

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionTitle("颜色 · 语义层")
        SectionGroup("背景与表面") {
            SwatchRow("background", colors.background, canvas, note = "画布")
            SwatchRow("surface", colors.surface, canvas, note = "卡片 / 浮层")
            SwatchRow("surfaceMuted", colors.surfaceMuted, canvas, note = "凹陷区域")
            SwatchRow("surfaceStrong", colors.surfaceStrong, canvas, note = "按压 / 分段背景")
        }
        SectionGroup("文字（对画布对比度）") {
            ContrastSwatchRow("text", colors.text, canvas)
            ContrastSwatchRow("textSecondary", colors.textSecondary, canvas)
            ContrastSwatchRow("textTertiary", colors.textTertiary, canvas)
        }
        SectionGroup("交互") {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(MosaicTheme.shapes.small)
                        .background(colors.primary),
                    contentAlignment = Alignment.Center,
                ) {
                    MosaicText(
                        text = "Aa",
                        style = MosaicTheme.typography.label,
                        color = colors.onPrimary,
                    )
                }
                Column {
                    MosaicText(
                        "primary / onPrimary",
                        style = MosaicTheme.typography.label,
                        color = colors.text,
                    )
                    MosaicText(
                        "onPrimary 对 primary %.1f:1".format(wcagContrast(colors.onPrimary, colors.primary)),
                        style = MosaicTheme.typography.caption,
                        color = colors.textTertiary,
                    )
                }
            }
            SwatchRow("primarySoft", colors.primarySoft, canvas, note = "选中底 / chip")
            ContrastSwatchRow("link", colors.link, canvas)
        }
        SectionGroup("状态") {
            StatusSwatchRow("success", colors.success, colors.successContainer)
            StatusSwatchRow("error", colors.error, colors.errorContainer)
            StatusSwatchRow("warning", colors.warning, colors.warningContainer)
            StatusSwatchRow("info", colors.info, colors.infoContainer)
        }
    }
}

@Composable
private fun SwatchRow(name: String, color: Color, canvas: Color, note: String? = null) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .size(44.dp)
                .clip(MosaicTheme.shapes.small)
                .background(color)
                .border(1.dp, MosaicTheme.colors.border, MosaicTheme.shapes.small),
        )
        Column {
            MosaicText(name, style = MosaicTheme.typography.label, color = MosaicTheme.colors.text)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MosaicText(
                    color.asHex(),
                    style = MosaicTheme.typography.caption,
                    color = MosaicTheme.colors.textTertiary,
                )
                if (note != null) {
                    MosaicText(note, style = MosaicTheme.typography.caption, color = MosaicTheme.colors.textTertiary)
                }
            }
        }
    }
}

@Composable
private fun ContrastSwatchRow(name: String, color: Color, canvas: Color) {
    val ratio = wcagContrast(color, canvas)
    val badge = when {
        ratio >= 4.5f -> "AA 正文"
        ratio >= 3f -> "AA 大字"
        else -> "仅装饰"
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .size(44.dp)
                .clip(MosaicTheme.shapes.small)
                .background(canvas)
                .border(1.dp, MosaicTheme.colors.border, MosaicTheme.shapes.small),
            contentAlignment = Alignment.Center,
        ) {
            MosaicText(
                text = "Aa",
                style = MosaicTheme.typography.titleLarge,
                color = color,
            )
        }
        Column {
            MosaicText(name, style = MosaicTheme.typography.label, color = MosaicTheme.colors.text)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MosaicText(
                    "${color.asHex()} · 对画布 %.1f:1".format(ratio),
                    style = MosaicTheme.typography.caption,
                    color = MosaicTheme.colors.textTertiary,
                )
                MosaicText(
                    badge,
                    style = MosaicTheme.typography.caption,
                    color = if (ratio >= 4.5f) MosaicTheme.colors.success else MosaicTheme.colors.warning,
                )
            }
        }
    }
}

@Composable
private fun StatusSwatchRow(name: String, color: Color, container: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .size(44.dp)
                .clip(MosaicTheme.shapes.small)
                .background(container)
                .border(1.dp, MosaicTheme.colors.border, MosaicTheme.shapes.small),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .size(10.dp)
                    .clip(MosaicTheme.shapes.pill)
                    .background(color),
            )
        }
        Column {
            MosaicText(name, style = MosaicTheme.typography.label, color = MosaicTheme.colors.text)
            MosaicText(
                "${color.asHex()} on ${container.asHex()} · %.1f:1".format(wcagContrast(color, container)),
                style = MosaicTheme.typography.caption,
                color = MosaicTheme.colors.textTertiary,
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

@Composable
internal fun TypeSection() {
    val colors = MosaicTheme.colors
    val typography = MosaicTheme.typography
    val styles = listOf(
        "display" to typography.display,
        "titleLarge" to typography.titleLarge,
        "title" to typography.title,
        "bodyLarge" to typography.bodyLarge,
        "body" to typography.body,
        "label" to typography.label,
        "caption" to typography.caption,
    )

    Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
        SectionTitle("字体 · 七级字阶")
        styles.forEach { (name, style) ->
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                MosaicText(
                    text = "纸间栖息 · ${style.fontSize.value.toInt()}sp",
                    style = style,
                    color = colors.text,
                    maxLines = 1,
                )
                MosaicText(
                    text = "$name · ${style.fontSize.value.toInt()}/${style.lineHeight.value.toInt()} · " +
                        "w${style.fontWeight?.weight ?: 400} · ${style.letterSpacing.value}sp",
                    style = MosaicTheme.typography.caption,
                    color = colors.textTertiary,
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Mood
// ---------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MoodSection() {
    var selected by remember { mutableStateOf(MoodKey.Joy) }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionTitle("心情 · 内容色")
        MosaicText(
            text = "点击切换选中态",
            style = MosaicTheme.typography.caption,
            color = MosaicTheme.colors.textTertiary,
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            MoodKey.entries.forEach { mood ->
                MoodChip(
                    mood = mood,
                    selected = mood == selected,
                    onClick = { selected = mood },
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

@Composable
internal fun ComponentSection() {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionTitle("组件")

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            MosaicText(
                text = "按钮",
                style = MosaicTheme.typography.label,
                color = MosaicTheme.colors.textSecondary,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MosaicButton(text = "Filled", onClick = {}, variant = MosaicButtonVariant.Filled)
                MosaicButton(text = "Soft", onClick = {}, variant = MosaicButtonVariant.Soft)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MosaicButton(text = "Outline", onClick = {}, variant = MosaicButtonVariant.Outline)
                MosaicButton(text = "Ghost", onClick = {}, variant = MosaicButtonVariant.Ghost)
                MosaicButton(text = "Disabled", onClick = {}, enabled = false)
            }
        }

        MemoCardSample()

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(MosaicTheme.shapes.medium)
                .background(MosaicTheme.colors.successContainer)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                Modifier
                    .size(8.dp)
                    .clip(MosaicTheme.shapes.pill)
                    .background(MosaicTheme.colors.success),
            )
            MosaicText(
                text = "已同步 · 128 条记录",
                style = MosaicTheme.typography.label,
                color = MosaicTheme.colors.success,
            )
        }
    }
}

@Composable
private fun MemoCardSample() {
    val colors = MosaicTheme.colors
    Column(
        Modifier
            .fillMaxWidth()
            .clip(MosaicTheme.shapes.large)
            .background(colors.surface)
            .border(1.dp, colors.border, MosaicTheme.shapes.large)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            MosaicText(
                text = "9月21日 周日",
                style = MosaicTheme.typography.label,
                color = colors.textSecondary,
                modifier = Modifier.weight(1f),
            )
            MoodChip(mood = MoodKey.Calm, selected = true)
        }
        MosaicText(
            text = "把 design-core 的骨架搭起来了。四个方向的主题可以在目录里实时切换，" +
                "组件在同一套语义层上换色——这才是三层 token 的意义。",
            style = MosaicTheme.typography.body,
            color = colors.text,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("#设计系统", "#Compose", "#迁移").forEach { tag ->
                Box(
                    Modifier
                        .clip(MosaicTheme.shapes.pill)
                        .background(colors.surfaceStrong)
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                ) {
                    MosaicText(
                        text = tag,
                        style = MosaicTheme.typography.caption,
                        color = colors.textSecondary,
                    )
                }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(colors.border),
        )
        MosaicText(
            text = "AI 摘要：完成设计系统骨架，待真机验证。",
            style = MosaicTheme.typography.caption,
            color = colors.textTertiary,
        )
    }
}
