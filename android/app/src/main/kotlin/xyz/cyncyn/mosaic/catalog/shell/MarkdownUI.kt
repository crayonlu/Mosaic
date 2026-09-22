package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.data.markdown.MarkdownBlock
import xyz.cyncyn.mosaic.data.markdown.MarkdownBlockType
import xyz.cyncyn.mosaic.data.markdown.TokenKind
import xyz.cyncyn.mosaic.data.markdown.highlightCode
import xyz.cyncyn.mosaic.data.markdown.splitMarkdownBlocks

/** Renders markdown blocks with design tokens only (no Material, no WebView). */
@Composable
fun MarkdownBody(source: String, modifier: Modifier = Modifier) {
    // Parsing runs off the main thread; the first frame renders empty rather
    // than stalling composition on a cold parse.
    val blocks by produceState(initialValue = emptyList(), key1 = source) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            splitMarkdownBlocks(source)
        }
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        blocks.forEach { block -> MarkdownBlockView(block) }
    }
}

@Composable
private fun MarkdownBlockView(block: MarkdownBlock) {
    val colors = MosaicTheme.colors
    when (block.type) {
        MarkdownBlockType.Heading -> MosaicText(
            text = block.text,
            style = if (block.level <= 2) MosaicTheme.typography.titleLarge else MosaicTheme.typography.title,
            color = colors.text,
        )
        MarkdownBlockType.Paragraph -> MosaicText(
            text = "",
            style = MosaicTheme.typography.body,
            color = colors.text,
            annotated = inlineAnnotated(block.text, colors.link, colors.primary),
        )
        MarkdownBlockType.CodeFence -> CodeBlock(code = block.text, language = block.language)
        MarkdownBlockType.Quote -> Row {
            Box(
                Modifier
                    .width(3.dp)
                    .padding(vertical = 2.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(colors.borderStrong),
            )
            MosaicText(
                text = "",
                style = MosaicTheme.typography.body,
                color = colors.textSecondary,
                modifier = Modifier.padding(start = 10.dp),
                annotated = inlineAnnotated(block.text, colors.link, colors.primary),
            )
        }
        MarkdownBlockType.ListItem -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            block.items.forEach { item ->
                Row {
                    MosaicText(text = "·", style = MosaicTheme.typography.body, color = colors.textTertiary)
                    MosaicText(
                        text = "",
                        style = MosaicTheme.typography.body,
                        color = colors.text,
                        modifier = Modifier.padding(start = 8.dp),
                        annotated = inlineAnnotated(item, colors.link, colors.primary),
                    )
                }
            }
        }
        MarkdownBlockType.Rule -> Box(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 2.dp)
                .clip(RoundedCornerShape(1.dp))
                .background(colors.border),
        )
    }
}

private val BOLD_RE = Regex("\\*\\*(.+?)\\*\\*|__(.+?)__")
private val ITALIC_RE = Regex("(?<!\\*)\\*([^*\\s][^*]*?)\\*(?!\\*)")
private val STRIKE_RE = Regex("~~(.+?)~~")
private val INLINE_CODE_RE = Regex("`([^`]+)`")

/** Inline markdown: **bold**, *italic*, `code`, ~~strike~~. */
fun inlineAnnotated(text: String, linkColor: androidx.compose.ui.graphics.Color, codeColor: androidx.compose.ui.graphics.Color): AnnotatedString =
    buildAnnotatedString {
        append(text)
        for (match in BOLD_RE.findAll(text)) {
            addStyle(SpanStyle(fontWeight = FontWeight.Bold), match.range.first, match.range.last + 1)
        }
        for (match in ITALIC_RE.findAll(text)) {
            addStyle(SpanStyle(fontStyle = androidx.compose.ui.text.font.FontStyle.Italic), match.range.first, match.range.last + 1)
        }
        for (match in STRIKE_RE.findAll(text)) {
            addStyle(SpanStyle(textDecoration = TextDecoration.LineThrough), match.range.first, match.range.last + 1)
        }
        for (match in INLINE_CODE_RE.findAll(text)) {
            addStyle(SpanStyle(background = codeColor.copy(alpha = 0.14f), fontWeight = FontWeight.Medium), match.range.first, match.range.last + 1)
        }
    }

@Composable
private fun CodeBlock(code: String, language: String?) {
    val colors = MosaicTheme.colors
    // Code keeps the dark "ink slab" look in both modes; base text uses the
    // dark-mode ink so unspanned code stays readable on it.
    val darkInk = remember { xyz.cyncyn.mosaic.design.theme.semanticColors(xyz.cyncyn.mosaic.design.theme.ThemeDirection.Ink, dark = true) }
    val codeBackground = if (colors.isDark) colors.surfaceMuted else darkInk.surface
    val spans = remember(code, language) { highlightCode(code, language) }

    fun spanColor(kind: TokenKind): androidx.compose.ui.graphics.Color = when (kind) {
        TokenKind.Keyword -> Color(0xFFE8B98A)
        TokenKind.String_ -> Color(0xFFA8C37E)
        TokenKind.Comment -> darkInk.textTertiary
        TokenKind.Number_ -> Color(0xFFD9A66C)
        TokenKind.Function -> Color(0xFFC9D8E8)
        TokenKind.Plain -> darkInk.text
    }

    val annotated = remember(code, spans) {
        buildAnnotatedString {
            append(code)
            for (span in spans) {
                if (span.end > span.start) {
                    addStyle(SpanStyle(color = spanColor(span.kind)), span.start, span.end)
                }
            }
        }
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(MosaicTheme.shapes.medium)
            .background(codeBackground)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        language?.let {
            MosaicText(
                text = it,
                style = MosaicTheme.typography.caption,
                color = colors.textTertiary,
            )
        }
        MosaicText(
            text = "",
            style = MosaicTheme.typography.label,
            color = darkInk.text,
            annotated = annotated,
        )
    }
}
