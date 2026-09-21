package xyz.cyncyn.mosaic.design.component

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

/**
 * The only text entry point of the design system. Wraps BasicText so the
 * theme is applied without depending on Material's LocalTextStyle.
 * Pass [annotated] for rich content (inline markdown, highlighted code);
 * it takes precedence over [text].
 */
@Composable
fun MosaicText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MosaicTheme.typography.body,
    color: Color = MosaicTheme.colors.text,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
    annotated: AnnotatedString? = null,
) {
    val resolvedStyle = style.copy(color = color)
    if (annotated != null) {
        BasicText(
            text = annotated,
            modifier = modifier,
            style = resolvedStyle,
            maxLines = maxLines,
            overflow = overflow,
        )
    } else {
        BasicText(
            text = text,
            modifier = modifier,
            style = resolvedStyle,
            maxLines = maxLines,
            overflow = overflow,
        )
    }
}
