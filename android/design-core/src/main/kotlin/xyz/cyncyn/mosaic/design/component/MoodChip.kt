package xyz.cyncyn.mosaic.design.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.design.token.MoodKey
import xyz.cyncyn.mosaic.design.token.MoodToken
import xyz.cyncyn.mosaic.design.token.moodTokens

/**
 * Mood chip. Selected state fills with the mood color; unselected stays on
 * surface with a mood-colored dot so the full ramp stays visible without noise.
 */
@Composable
fun MoodChip(
    mood: MoodKey,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    val colors = MosaicTheme.colors
    val shapes = MosaicTheme.shapes
    val token: MoodToken = moodTokens(colors.isDark).getValue(mood)

    val background = if (selected) token.container else colors.surface
    val textColor = if (selected) token.onContainer else colors.textSecondary
    val borderColor = if (selected) token.border else colors.border

    val interactionSource = remember { MutableInteractionSource() }

    Row(
        modifier = modifier
            .clip(shapes.pill)
            .then(
                if (onClick != null) {
                    Modifier.clickable(
                        interactionSource = interactionSource,
                        indication = MosaicPressIndication,
                        onClick = onClick,
                    )
                } else {
                    Modifier
                },
            )
            .background(background, shapes.pill)
            .border(1.dp, borderColor, shapes.pill)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (!selected) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(token.container),
            )
        }
        MosaicText(text = mood.label, style = MosaicTheme.typography.label, color = textColor)
    }
}
